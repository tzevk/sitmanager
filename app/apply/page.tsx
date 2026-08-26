'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Data ───────────────────────────────────────────────────────────────────

const STATS = [
  { value: 18000, suffix: '+', label: 'Students Trained' },
  { value: 650,   suffix: '+', label: 'Successful Batches' },
  { value: 250,   suffix: '+', label: 'Corporate Training' },
  { value: 40,    suffix: '+', label: 'Professional Training' },
];

const PROGRAMMES = [
  { name: 'Piping Engineering', icon: '🔧' },
  { name: 'Process Engineering', icon: '⚗️' },
  { name: 'Mechanical Design of Process Equipment', icon: '⚙️' },
  { name: 'Advance Pipe Stress Analysis', icon: '📐' },
  { name: 'Pipeline Engineering', icon: '🛢️' },
  { name: 'Offshore Engineering', icon: '🌊' },
  { name: 'Plant Design Management System (PDMS)', icon: '🏭' },
  { name: 'Piping Materials', icon: '🔩' },
  { name: 'Piping Design & Drafting', icon: '✏️' },
  { name: 'Water & Waste Water Engg.', icon: '💧' },
  { name: 'Air Conditioning System Design (HVAC)', icon: '❄️' },
  { name: 'Electrical System Design', icon: '⚡' },
  { name: 'Process Instrumentation & Control', icon: '🎛️' },
  { name: 'Electrical & Instrumentation Design and Drafting', icon: '🔌' },
  { name: 'Engineering Design & Drafting', icon: '📏' },
  { name: 'Structural Engineering', icon: '🏗️' },
  { name: 'Health, Safety & Environment in Construction', icon: '🦺' },
  { name: 'Autocad - Piping', icon: '🖥️' },
];

const COURSES = PROGRAMMES.map((p) => p.name);

const QUALIFICATIONS = ['S.S.C.', 'H.S.C.', 'I.T.I.', 'Diploma', 'B.E. / B.Tech', 'M.E. / M.Tech', 'BSC', 'MSC', 'P.HD.', 'OTHERS'];
const DISCIPLINES = ['Mechanical', 'Chemical', 'Civil', 'Electrical', 'Electronics & Tele-Communication', 'Instrumentation', 'Computers', 'Automobile', 'Petrochemical', 'Industrial', 'Commerce', 'Science', 'Arts', 'Others'];
const SOURCES = ['Website', 'Google', 'Facebook', 'Reference', 'Ex-Student', 'Seminar', 'Advertisement', 'News Paper', 'Exhibition', 'India Mart', 'Others'];

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) { setStarted(true); return; }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { count, ref };
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} className="flex flex-col items-center py-8 px-4">
      <span className="text-4xl sm:text-5xl font-black text-white tabular-nums">
        {count.toLocaleString()}{suffix}
      </span>
      <span className="mt-3 block h-1 w-14 rounded-full bg-[#FAE452]" />
      <span className="mt-3 text-sm sm:text-base font-medium text-slate-300 text-center">{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const [form, setForm] = useState({
    course: '', name: '', mobile: '', email: '',
    qualification: '', discipline: '', gender: '', source: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLElement>(null);

  const set = useCallback((key: string, value: string) => setForm((f) => ({ ...f, [key]: value })), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Student_Name: form.name,
          Inquiry_Type: 'Online Inquiry',
          Course_Name: form.course || null,
          Qualification: form.qualification || null,
          Discipline: form.discipline || null,
          Sex: form.gender || null,
          Present_Mobile: form.mobile,
          Email: form.email,
          Discussion: form.notes || null,
          Inquiry_From: form.source || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Submission failed');
      setForm({ course: '', name: '', mobile: '', email: '', qualification: '', discipline: '', gender: '', source: '', notes: '' });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const inp = 'w-full rounded border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20';
  const sel = `${inp} appearance-none`;

  return (
    <div className="relative min-h-screen bg-white text-slate-900">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-[#1a2744] shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/sit.png" alt="SIT" width={56} height={56} className="h-14 w-14 object-contain" priority />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#FAE452]">Suvidya Institute of Technology</p>
              <p className="text-[10px] text-slate-400 leading-tight">World Class Industrial Training</p>
            </div>
          </div>
          <button
            onClick={scrollToForm}
            className="hidden sm:inline-flex items-center gap-2 rounded bg-[#FAE452] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1a2744] hover:bg-yellow-400 transition-colors"
          >
            Enquire Now
          </button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2744]">
        <div className="absolute inset-0">
          <Image src="/banner.jpg" alt="" fill className="object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a2744]/95 via-[#1a2744]/80 to-[#2E3093]/70" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left copy */}
          <div className="text-center lg:text-left">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FAE452] mb-3">Enrol Today</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-white">
              Build Your Career in<br />
              <span className="text-[#FAE452]">Engineering</span>
            </h1>
            <p className="mt-5 text-base text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Industry-aligned training programmes in Piping, Process, Mechanical, Electrical &amp; more — designed for freshers and working professionals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <button onClick={scrollToForm} className="rounded bg-[#FAE452] px-6 py-3 text-sm font-black uppercase tracking-wider text-[#1a2744] hover:bg-yellow-400 transition-colors shadow-lg">
                Enquire Now
              </button>
              <a href="tel:+912269701234" className="rounded border-2 border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors">
                Call Now
              </a>
            </div>
          </div>

          {/* Quick form */}
          <div ref={formRef as React.RefObject<HTMLElement>} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-sm p-6 lg:p-8">
            {done ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-black text-white">Thank You!</h3>
                <p className="mt-2 text-slate-300 text-sm">Your enquiry has been submitted. Our team will contact you shortly.</p>
                <button onClick={() => setDone(false)} className="mt-6 rounded bg-[#FAE452] px-5 py-2 text-sm font-bold text-[#1a2744] hover:bg-yellow-400">
                  Submit Another
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-black text-white mb-5">Free Counselling — Enquire Now</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <select className={sel} value={form.course} onChange={(e) => set('course', e.target.value)}>
                    <option value="">Select Course *</option>
                    {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className={inp} placeholder="Full Name *" required value={form.name} onChange={(e) => set('name', e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inp} placeholder="Mobile *" type="tel" required value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                    <input className={inp} placeholder="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className={sel} value={form.qualification} onChange={(e) => set('qualification', e.target.value)}>
                      <option value="">Qualification</option>
                      {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <select className={sel} value={form.source} onChange={(e) => set('source', e.target.value)}>
                      <option value="">How did you hear?</option>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {error && <p className="rounded bg-red-500/20 border border-red-400/30 px-3 py-2 text-xs text-red-300">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded bg-[#FAE452] py-3 text-sm font-black uppercase tracking-wider text-[#1a2744] hover:bg-yellow-400 transition-colors disabled:opacity-60 shadow-lg"
                  >
                    {submitting ? 'Submitting…' : 'SUBMIT'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── TAGLINE ────────────────────────────────────────────────────────── */}
      <section className="bg-[#b8e4f9] px-4 py-12 sm:py-16 text-center">
        <p className="mx-auto max-w-3xl text-2xl sm:text-3xl lg:text-4xl font-black leading-snug text-[#1a2744]">
          <span className="text-[#e6a800]">SUVIDYA INSTITUTE</span>{' '}
          provides World Class Industrial Training in all disciplines of Engineering.
        </p>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2744]">
        <div className="absolute inset-0">
          <Image src="/phot.jpg" alt="" fill className="object-cover opacity-15" />
          <div className="absolute inset-0 bg-[#1a2744]/85" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/10">
            {STATS.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMMES ─────────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#2E3093] mb-2">What We Offer</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744] uppercase leading-tight">
              Training Programme for Learners at<br className="hidden sm:block" /> Every Career Stage
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-[#FAE452]" />
            <p className="mt-5 mx-auto max-w-3xl text-sm sm:text-base text-slate-600 uppercase leading-relaxed font-medium">
              Our programs cover the entire spectrum of technical training in all the engineering disciplines
              to meet the requirements of skilled manpower in the field of{' '}
              <span className="text-[#2E3093] font-bold">&quot;Oil &amp; Gas&quot;</span>,{' '}
              Petrochemical &amp; various Process Chemical Plant industries.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROGRAMMES.map((prog, i) => (
              <div
                key={prog.name}
                className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 hover:border-[#2E3093]/30 hover:bg-[#2E3093]/5 hover:shadow-md transition-all cursor-default"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-lg shadow-sm group-hover:border-[#2E3093]/20">
                  {prog.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 group-hover:text-[#2E3093] transition-colors">{prog.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Professional · {i % 3 === 0 ? 'Full Time' : i % 3 === 1 ? 'Weekend' : 'Part Time'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SIT ────────────────────────────────────────────────────────── */}
      <section className="bg-[#f0f7ff] px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744] uppercase">Why Choose SIT?</h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-[#FAE452]" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🎓', title: 'Expert Faculty', desc: 'Learn from industry veterans with 15+ years of hands-on experience' },
              { icon: '🏭', title: 'Industry Projects', desc: 'Work on real-world projects from Oil & Gas and Petrochemical sectors' },
              { icon: '💼', title: 'Placement Support', desc: 'Dedicated placement cell with strong industry connections' },
              { icon: '📜', title: 'Recognised Certification', desc: 'Certificates recognised by leading engineering companies across India' },
            ].map((item) => (
              <div key={item.title} className="text-center rounded-2xl bg-white border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-black text-[#1a2744] mb-2">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FULL ENQUIRY FORM ───────────────────────────────────────────────── */}
      <section id="enquire" className="bg-[#1a2744] px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#FAE452] mb-2">Get In Touch</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Request Free Counselling</h2>
            <p className="mt-2 text-slate-400 text-sm">Fill in your details and our team will reach out within 24 hours.</p>
          </div>

          {done ? (
            <div className="text-center py-12 rounded-2xl bg-white/10 border border-white/10">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-black text-white">Thank You!</h3>
              <p className="mt-2 text-slate-300">Your enquiry has been received. We&apos;ll call you shortly.</p>
              <button onClick={() => setDone(false)} className="mt-6 rounded bg-[#FAE452] px-6 py-2.5 text-sm font-bold text-[#1a2744] hover:bg-yellow-400">
                Submit Another Enquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 sm:p-8 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Training Programme *</label>
                  <select className={sel} value={form.course} onChange={(e) => set('course', e.target.value)} required>
                    <option value="">Select programme</option>
                    {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input className={inp} placeholder="Enter your full name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number *</label>
                  <input className={inp} type="tel" placeholder="Enter mobile number" required value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input className={inp} type="email" placeholder="Enter email address" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Qualification</label>
                  <select className={sel} value={form.qualification} onChange={(e) => set('qualification', e.target.value)}>
                    <option value="">Select qualification</option>
                    {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Discipline / Branch</label>
                  <select className={sel} value={form.discipline} onChange={(e) => set('discipline', e.target.value)}>
                    <option value="">Select discipline</option>
                    {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                  <div className="flex gap-4 rounded border border-slate-300 bg-white/95 px-3 py-2.5">
                    {['Male', 'Female'].map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="radio" name="gender2" value={g} checked={form.gender === g} onChange={() => set('gender', g)} className="accent-[#2E3093]" />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">How did you hear about us?</label>
                  <select className={sel} value={form.source} onChange={(e) => set('source', e.target.value)}>
                    <option value="">Select source</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Additional Notes</label>
                  <textarea className={`${inp} min-h-[80px] resize-y`} placeholder="Any specific queries or requirements…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </div>
              </div>
              {error && <p className="rounded bg-red-500/20 border border-red-400/30 px-3 py-2 text-xs text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-[#FAE452] py-3.5 text-sm font-black uppercase tracking-widest text-[#1a2744] hover:bg-yellow-400 transition-colors disabled:opacity-60 shadow-lg"
              >
                {submitting ? 'Submitting…' : 'SUBMIT ENQUIRY'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#111827] px-4 py-6 text-center">
        <Image src="/sit.png" alt="SIT" width={48} height={48} className="mx-auto h-12 w-12 object-contain opacity-80 mb-2" />
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</p>
      </footer>

      {/* ── STICKY BOTTOM CTA (mobile) ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch sm:hidden shadow-2xl border-t border-white/10">
        <a href="tel:+912269701234" className="flex flex-1 items-center justify-center gap-2 bg-[#FAE452] py-4 text-sm font-black uppercase tracking-wider text-[#1a2744]">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          Call Now
        </a>
        <div className="flex items-center justify-center w-14 bg-white z-10">
          <span className="text-[11px] font-black text-slate-500">OR</span>
        </div>
        <button onClick={scrollToForm} className="flex flex-1 items-center justify-center gap-2 bg-[#1a2744] py-4 text-sm font-black uppercase tracking-wider text-white">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          Enquire Now
        </button>
      </div>

      {/* Bottom padding for sticky bar on mobile */}
      <div className="h-16 sm:hidden" />
    </div>
  );
}
