'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

/* Public corporate-training page. Content and photos come from suvidya.ac.in
   (corporate training, customers, feedback and events pages). Images live in
   /public/corporate-training. Enquiries post to /api/public/corporate-inquiry. */

const IMG = (f: string) => `/corporate-training/${f}`;

const CLIENT_LOGOS = ['27', '28-1', '29-1', '30-1', '33-1', '34', '35-1', '36-1', '62-1', '63-1', '64-1', '65-1', '72', '74', '75', '76', '77', '78', '79', '80', '81', '83', '84'];

const EVENTS = [
  { client: 'MAN Energy Solutions India Pvt. Ltd, Aurangabad', title: 'Instrumentation & Control Training', desc: 'Instrumentation and control engineering for the client’s engineering team.', pics: ['man1', 'man2', 'man3'] },
  { client: 'Tata Consulting Engineers Ltd, Jamshedpur', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: '2023–24 batch of 162 trainees, started July 2023.', pics: ['tcejam2', 'tcejam1', 'tcejam3'] },
  { client: 'Tata Consulting Engineers Ltd, Pune', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: 'Discipline training for diploma holders joining TCE.', pics: ['tcepune1', 'tcepune2'] },
  { client: 'Tata Consulting Engineers Ltd, Mumbai', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: 'The same diploma-holder programme delivered for TCE Mumbai.', pics: ['tcemum1', 'tcemum2'] },
];

const MORE_EVENTS = [
  ['Tata Chemicals Ltd, Mithapur', 'Operation & Maintenance for Technicians & GET Engineers'],
  ['L&T Heavy Engineering, Hazira', 'Piping & Construction Training'],
  ['MAN Energy Solutions India Pvt. Ltd', 'Value Engineering Training'],
  ['Toyo Engineering India Pvt. Ltd.', 'GET Piping Engineering Training'],
  ['L&T Energy Hydrocarbon, Offshore Design & Engineering, Powai', 'Basic Offshore Training'],
  ['Shivajirao S. Jondhale College of Engineering', 'Basic Piping Workshop'],
];

const GALLERY = ['ev2', 'ev4', 'ev5', 'ev8', 'ev9', 'ev11', 'ev12', 'ev13', 'ev14', 'ev15'];

const PROGRAMMES = [
  { cat: 'Engineering', img: 'tcejam3', title: 'Piping & Process Engineering', items: ['Plant layout, piping design and engineering', 'Process Engineering', 'Process Instrumentation & Control', 'Advanced pipe stress analysis with CAESAR II'] },
  { cat: 'Engineering', img: 'tcemum2', title: 'Mechanical, Structural & MEP', items: ['Mechanical Design of Process Equipment', 'Structural Engineering', 'MEP, HVAC and Electrical System Design', 'Water & Waste Water Engineering'] },
  { cat: 'Design & Drafting', img: 'ev11', title: 'Design & Drafting', items: ['Engineering Design & Drafting', 'Piping Design & Drafting', 'HVAC Design & Drafting', 'Electrical & Instrumentation Design and Drafting'] },
  { cat: 'Software', img: 'ev13', title: 'Engineering Software', items: ['Process plant modelling with E3D and PDMS', 'Smart Plant P&ID', 'AutoCAD Piping and AutoCAD 2D', 'CAESAR II'] },
  { cat: 'Operation & Maintenance', img: 'tcepune2', title: 'Operation & Maintenance', items: ['O&M training for technicians and GET engineers', 'Rotating Equipment', 'Inspection and testing', 'Delivered for Tata Chemicals, Mithapur'] },
  { cat: 'Others', img: 'ev14', title: 'Specialised Programmes', items: ['Offshore Engineering and Fundamentals of Offshore', 'Fire Alarm and Protection System', 'Non-Destructive Testing (NDT) Level I & II', 'Custom topics from your working team'] },
];
const CATEGORIES = ['All', 'Engineering', 'Design & Drafting', 'Software', 'Operation & Maintenance', 'Others'];

const STEPS = [
  ['Pre-test', 'Checks each participant’s starting level before training begins.'],
  ['Assessment', 'Regular checks of understanding during the programme.'],
  ['Assignments', 'Practical work based on real project activities.'],
  ['Final exam', 'A closing test of what each participant has learned.'],
  ['Training material', 'Recorded as part of each participant’s evaluation.'],
  ['Attendance', 'Recorded for every session.'],
  ['Feedback', 'Collected from participants and from the client.'],
  ['SIT Certificate', 'Issued on the basis of performance and attendance.'],
];

const LETTERS = [
  ['fb-toyo', 'Toyo Engineering', 'Testimonial · 2023–24'],
  ['fb-wt', 'WT Cost Management India', 'MEP Training · 14 Mar 2023'],
  ['fb-konstelec', 'Konstelec Engineers', 'Electrical · 1 Nov 2022'],
  ['fb-mundra', 'Mundra Petrochemical Ltd.', 'Training feedback · 1 Nov 2022'],
  ['fb-ltvadodara', 'L&T Vadodara', 'Piping Advance · 8 Mar 2022'],
  ['fb-thyssenkrupp', 'thyssenkrupp', 'Management feedback · 25 Sep 2017'],
  ['fb-petrofac', 'Petrofac International, Sharjah', 'Feedback letter'],
  ['fb-man', 'MAN Diesel, Aurangabad', 'Feedback letter'],
];

const NAV = [
  ['#conducted', 'Trainings Conducted'],
  ['#programmes', 'Programmes'],
  ['#csr', 'CSR – TCE'],
  ['#method', 'Training Method'],
  ['#evaluation', 'Evaluation'],
  ['#feedback', 'Client Feedback'],
];

type Shot = { src: string; caption: string };

function Zoom({ file, caption, onOpen }: { file: string; caption: string; onOpen: (s: Shot) => void }) {
  return (
    <button type="button" className="ct-zoom" aria-label={`View photo: ${caption}`} onClick={() => onOpen({ src: IMG(`${file}.jpg`), caption })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG(`${file}.jpg`)} alt={caption} loading="lazy" />
    </button>
  );
}

const REEL = [
  { file: 'tcejam2', tag: 'CSR · Diploma holders', client: 'Tata Consulting Engineers, Jamshedpur' },
  { file: 'man3', tag: 'Instrumentation & Control', client: 'MAN Energy Solutions, Aurangabad' },
  { file: 'tcemum1', tag: 'Piping · Electrical · Civil', client: 'Tata Consulting Engineers, Mumbai' },
  { file: 'ev2', tag: 'Corporate training', client: 'SIT corporate batch' },
  { file: 'tcepune1', tag: 'Diploma holder programme', client: 'Tata Consulting Engineers, Pune' },
];

const HEADLINE = 'Training that is a|rehearsal of actual working|for your engineering teams.'
  .split('|')
  .flatMap((part, i) => part.split(' ').map((t) => ({ t, hi: i === 1 })));

const Icon = {
  doc: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>,
  phone: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>,
  mail: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>,
  pin: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  tick: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
};

/* SIT Manager's global styles make <body> the scroll container, so window.scrollY stays 0.
   Read whichever element is actually scrolling, and listen in the capture phase. */
const scrollY = () => Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop);
const scrollMax = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;

const EMPTY_FORM = { company: '', name: '', designation: '', email: '', phone: '', city: '', area: 'Engineering', mode: 'site', freshers: '', experienced: '', message: '', website: '' };

export default function CorporateTrainingPage() {
  const [shot, setShot] = useState<Shot | null>(null);
  const [cat, setCat] = useState('All');
  const [scrolled, setScrolled] = useState(false);
  const [reel, setReel] = useState(0);
  const [pastHero, setPastHero] = useState(false);
  const [photoSet, setPhotoSet] = useState<Shot[]>([]);
  const openSet = (list: Shot[], i = 0) => { setPhotoSet(list); setShot(list[i]); };
  const step = (d: number) => { if (!shot || photoSet.length < 2) return; const i = photoSet.findIndex((x) => x.src === shot.src); setShot(photoSet[(i + d + photoSet.length) % photoSet.length]); };
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => { const y = scrollY(); setScrolled(y > 8); setPastHero(y > window.innerHeight * 0.6); };
    onScroll();
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  useEffect(() => {
    if (!shot) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShot(null); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, photoSet]);

  // Hero reel: slow Ken Burns crossfade through real training photos.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setReel((r) => (r + 1) % REEL.length), 6000);
    return () => window.clearInterval(t);
  }, []);

  // Fade blocks in (blur + rise, staggered among siblings) as they scroll up;
  // anything already on screen stays visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.remove('is-pre'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll<HTMLElement>('[data-fade]').forEach((n) => {
      const sibs = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.hasAttribute('data-fade')) : [];
      n.style.setProperty('--i', String(Math.min(sibs.indexOf(n), 6)));
      if (n.getBoundingClientRect().top > window.innerHeight) { n.classList.add('is-pre'); io.observe(n); }
    });
    return () => io.disconnect();
  }, [cat]);

  // Scroll progress line + gentle parallax on large photos (one rAF per frame).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const max = scrollMax();
      root.style.setProperty('--p', String(max > 0 ? Math.min(scrollY() / max, 1) : 0));
      if (reduce) return;
      root.querySelectorAll<HTMLElement>('.ct-banner img, .ct-csr-pics img').forEach((img) => {
        const r = img.parentElement!.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const mid = r.top + r.height / 2 - window.innerHeight / 2;
        img.style.setProperty('--py', `${(-mid * 0.06).toFixed(1)}px`);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Cursor spotlight on cards.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>('.ct-acc, .ct-event, .ct-prog, .ct-track, .ct-step, .ct-letter, .ct-more li');
    cards.forEach((c) => c.classList.add('ct-spot'));
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.ct-spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    root.addEventListener('pointermove', onMove);
    return () => root.removeEventListener('pointermove', onMove);
  }, [cat]);

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = ([['company', 'company name'], ['name', 'your name'], ['email', 'email'], ['phone', 'phone number']] as const).find(([k]) => !form[k].trim());
    if (missing) { setError(`Please enter ${missing[1]}.`); document.getElementById(`ct-${missing[0]}`)?.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Please enter a valid email address, like name@company.com.'); document.getElementById('ct-email')?.focus(); return; }
    setError(''); setSending(true);
    try {
      const res = await fetch('/api/public/corporate-inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not send your enquiry. Please call +91 98215 69885.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your enquiry. Please call +91 98215 69885.');
    } finally { setSending(false); }
  }

  const progs = PROGRAMMES.filter((p) => cat === 'All' || p.cat === cat);

  return (
    <div className="ct" ref={rootRef}>
      <div className="ct-progress" aria-hidden="true" />
      <div className="ct-grain" aria-hidden="true" />
      {/* ── Nav ── */}
      <header className={`ct-nav${scrolled ? ' is-scrolled' : ''}${pastHero ? ' is-past' : ''}`}>
        <div className="ct-wrap">
          <a className="ct-brand" href="#top" aria-label="SIT Corporate Training – top of page">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG('sit-logo.png')} alt="SIT – Suvidya Institute of Technology" />
            <span className="ct-brand-text"><b>Suvidya Institute of Technology Pvt. Ltd.</b><span>Corporate Training</span></span>
          </a>
          <ul className="ct-links">{NAV.map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}</ul>
          <a className="ct-btn ct-btn-indigo" href="#enquiry">Enquire Now</a>
        </div>
      </header>

      <main id="top">
        {/* ── Hero ── */}
        <section className="ct-hero ct-dark">
          <div className="ct-reel" aria-hidden="true">
            {REEL.map((r, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={r.file} src={IMG(`${r.file}.jpg`)} alt="" className={i === reel ? 'is-on' : ''} />
            ))}
          </div>
          <div className="ct-credit" aria-live="off">
            <b>{REEL[reel].tag}</b>{REEL[reel].client}
            <div className="ct-dots">{REEL.map((r, i) => <i key={r.file} className={i === reel ? 'is-on' : ''} />)}</div>
          </div>
          <div className="ct-wrap">
            <div className="ct-hero-grid">
              <div>
                <div className="ct-since"><b>2009 – 2026</b> Corporate training across India &amp; abroad</div>
                <h1 aria-label="Training that is a rehearsal of actual working for your engineering teams.">
                  {HEADLINE.map((w, i) => (
                    <span key={i} aria-hidden="true">
                      <span className="ct-word" style={{ animationDelay: `${0.15 + i * 0.07}s`, color: w.hi ? 'var(--yellow)' : undefined }}>{w.t}</span>{' '}
                    </span>
                  ))}
                </h1>
                <p className="ct-lede">Suvidya Institute of Technology designs customised training for company employees in engineering design, procurement, construction, operation and maintenance, built around your current project requirements.</p>
                <div className="ct-cta">
                  <a className="ct-btn ct-btn-yellow" href="#enquiry">Plan a Training →</a>
                  <a className="ct-btn ct-btn-line" href="#conducted">See Trainings Conducted</a>
                </div>
              </div>
            </div>
            <div className="ct-stats">
              <div className="ct-stat"><b>250<i>+</i></b><span>Corporate trainings for EPC companies, refineries, chemical plants and government bodies</span></div>
              <div className="ct-stat"><b>21,000<i>+</i></b><span>Engineers and draughtsmen trained</span></div>
              <div className="ct-stat"><b>39</b><span>Nationalities trained</span></div>
              <div className="ct-stat"><b>20<i>+ yrs</i></b><span>Industry experience of our trainers</span></div>
            </div>
          </div>
        </section>
        <div className="ct-hazard" aria-hidden="true" />

        {/* ── Client logos ── */}
        <div className="ct-ticker" aria-label="Some of our corporate clients">
          <p className="ct-ticker-label">Trusted by international &amp; Indian companies</p>
          <div className="ct-ticker-track">
            {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((n, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={IMG(`cl-${n}.png`)} alt={i < CLIENT_LOGOS.length ? 'Corporate client logo' : ''} loading="lazy" />
            ))}
          </div>
        </div>

        {/* ── Accreditation ── */}
        <section className="ct-section ct-paper" id="about">
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow">Accreditation &amp; association</span>
              <h2>Certified, affiliated and <em>trusted by industry</em></h2>
              <p>SIT was formed to make engineers and draughtsmen eligible for working in global industry. Our corporate programmes carry the same accreditation as our professional courses.</p>
            </div>
            <div className="ct-feature" data-fade>
              <span className="ct-seal">Only in India</span>
              <strong>ECITB, United Kingdom</strong>
              <p>SIT is the only institute in India affiliated with the Engineering Construction Industry Training Board, for the Plant Layout Design training programme.</p>
            </div>
            <dl className="ct-creds">
              <div data-fade><dt>ISO 9001:2015</dt><dd>Certified by Bureau of Indian Standards</dd></div>
              <div data-fade><dt>NSDC</dt><dd>Partner, National Skill Development Corporation</dd></div>
              <div data-fade><dt>Germany</dt><dd>Certified Fit for Partnership</dd></div>
              <div data-fade><dt>MSME</dt><dd>Registered with the Ministry of MSME</dd></div>
              <div data-fade><dt>CII · MCC</dt><dd>Member, Confederation of Indian Industry and Maharashtra Chamber of Commerce</dd></div>
            </dl>
          </div>
        </section>

        {/* ── 1. Trainings conducted ── */}
        <section className="ct-section ct-paper" id="conducted" style={{ background: 'var(--paper-2)' }}>
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow"><b>01</b>2009 – 2026 · Trainings conducted</span>
              <h2>Corporate trainings <em>we have delivered</em></h2>
              <p>Over two decades, clients have come back to us for repeat training. Each programme below was delivered on site or at SIT, with a syllabus built for that team.</p>
            </div>
            <div className="ct-films">
              {EVENTS.map((ev) => (
                <button
                  type="button"
                  className="ct-film"
                  key={ev.client}
                  data-fade
                  aria-label={`View photos: ${ev.client} – ${ev.title}`}
                  onClick={() => openSet(ev.pics.map((p) => ({ src: IMG(`${p}.jpg`), caption: `${ev.client} – ${ev.title}` })))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG(`${ev.pics[0]}.jpg`)} alt="" loading="lazy" />
                  <span className="ct-film-body">
                    <span className="ct-film-client">{ev.client}</span>
                    <span className="ct-film-title">{ev.title}</span>
                    <span className="ct-film-desc">{ev.desc}</span>
                  </span>
                  <span className="ct-film-thumbs" aria-hidden="true">
                    {ev.pics.slice(1).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p} src={IMG(`${p}.jpg`)} alt="" loading="lazy" />
                    ))}
                  </span>
                </button>
              ))}
            </div>
            <div className="ct-ledger" data-fade>
              <p className="ct-ledger-title">Also delivered</p>
              <ul>
                {MORE_EVENTS.map(([c, t]) => <li key={c + t}><b>{c}</b><span>{t}</span></li>)}
              </ul>
            </div>
          </div>
          <div className="ct-strip" aria-label="Photos from SIT corporate trainings">
            <div className="ct-strip-track">
              {[...GALLERY, ...GALLERY].map((p, i) => (
                <button key={i} type="button" className="ct-strip-item" tabIndex={i < GALLERY.length ? 0 : -1} aria-hidden={i >= GALLERY.length} aria-label="View photo" onClick={() => openSet(GALLERY.map((g) => ({ src: IMG(`${g}.jpg`), caption: 'SIT corporate training' })), i % GALLERY.length)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG(`${p}.jpg`)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          <div className="ct-wrap">
            <div className="ct-syllabus" data-fade>
              <div className="ct-ico">{Icon.doc}</div>
              <div><b>Every syllabus is custom-made</b><p>We collect the list of topics from your working team and turn it into a training programme, so the training covers the work your engineers actually do.</p></div>
              <a className="ct-btn ct-btn-yellow" href="#enquiry">Request a sample syllabus</a>
            </div>
          </div>
        </section>

        {/* ── 2. Programmes ── */}
        <section className="ct-section ct-paper" id="programmes">
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow"><b>02</b>New training programmes</span>
              <h2>Programmes for <em>every engineering team</em></h2>
              <p>Engineering, drafting, software, operation &amp; maintenance and more. Choose a programme or ask us to combine topics. Software is taught alongside the engineering concepts, codes and standards.</p>
            </div>
            <div className="ct-tabs" role="tablist" aria-label="Programme area">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" role="tab" className="ct-tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="ct-progs">
              {progs.map((p) => (
                <article className="ct-prog" key={p.title}>
                  <div className="ct-prog-ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={IMG(`${p.img}.jpg`)} alt={`${p.title} training`} loading="lazy" />
                    <span>{p.cat}</span>
                  </div>
                  <div className="ct-prog-body">
                    <h3>{p.title}</h3>
                    <ul>{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. CSR – TCE ── */}
        <div className="ct-hazard" aria-hidden="true" />
        <section className="ct-section ct-dark" id="csr">
          <div className="ct-wrap">
            <div className="ct-csr-grid">
              <div data-fade>
                <div className="ct-head" style={{ marginBottom: 0 }}>
                  <span className="ct-eyebrow"><b>03</b>CSR report · Tata Consulting Engineers</span>
                  <h2>Skilling diploma holders with <em>Tata Consulting Engineers</em></h2>
                  <p>SIT delivers TCE’s training programme for diploma holders, building job-ready skills in piping, electrical and civil engineering. The programme has run at TCE’s Jamshedpur, Pune and Mumbai locations.</p>
                </div>
                <div className="ct-csr-nums">
                  <div><b>162</b><span>trainees in the Jamshedpur 2023–24 batch</span></div>
                  <div><b>3</b><span>disciplines: piping, electrical, civil</span></div>
                  <div><b>3</b><span>locations: Jamshedpur, Pune, Mumbai</span></div>
                </div>
                <div className="ct-chips"><span>Piping</span><span>Electrical</span><span>Civil</span><span>Diploma holders</span></div>
              </div>
              <div className="ct-csr-pics" data-fade>
                <Zoom file="tcejam2" caption="TCE Jamshedpur – 2023–24 batch, July 2023" onOpen={setShot} />
                <Zoom file="tcejam1" caption="TCE Jamshedpur – batch completion" onOpen={setShot} />
                <Zoom file="tcemum2" caption="TCE Mumbai – diploma holder training" onOpen={setShot} />
              </div>
            </div>
          </div>
        </section>
        <div className="ct-hazard" aria-hidden="true" />

        {/* ── 4. Training method ── */}
        <section className="ct-section ct-paper" id="method">
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow"><b>04</b>Training method</span>
              <h2>Two tracks, one goal: <em>productive from day one</em></h2>
              <p>The Employability Skill Enhancing Training Program is shaped for where your people are in their careers.</p>
            </div>
            <div className="ct-tracks">
              <div className="ct-track" data-fade><span className="ct-letter" aria-hidden="true">A</span><span className="ct-tag">For graduate trainee engineers</span><h3>Case-study training from concept to commissioning</h3><p>To bring new engineers into working in the shortest time, they are trained and guided through the project activities done regularly from concept to commissioning, using case studies.</p></div>
              <div className="ct-track" data-fade><span className="ct-letter" aria-hidden="true">B</span><span className="ct-tag">For experienced professionals</span><h3>Custom-made training based on your projects</h3><p>Engineers who have worked on projects for years sharpen their skills in new technologies, concepts, codes and standards, and statutory requirements. Topics are collected from the working team, so the training reduces mistakes on real projects.</p></div>
            </div>
            <div className="ct-principles">
              <div className="ct-pr" data-fade><b>Rehearsal of actual working</b><span>Training mirrors the activities your team performs on projects.</span></div>
              <div className="ct-pr" data-fade><b>Manual work first</b><span>Participants work by hand to visualise the system and understand the concept, which builds confidence.</span></div>
              <div className="ct-pr" data-fade><b>Codes &amp; standards</b><span>Detailed concept engineering with the relevant codes and standards.</span></div>
              <div className="ct-pr" data-fade><b>Industry software</b><span>PDMS, E3D, CAESAR II, AutoCAD and more, taught with the engineering concepts.</span></div>
            </div>
            <div className="ct-banner" data-fade>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG('tcepune1.jpg')} alt="Classroom training for Tata Consulting Engineers trainees, Pune" loading="lazy" />
              <p>Trainers with <span>20+ years</span> of industry experience, teaching what they have built.</p>
            </div>
          </div>
        </section>

        {/* ── 5. Evaluation ── */}
        <section className="ct-section ct-paper" id="evaluation" style={{ background: 'var(--paper-2)' }}>
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow"><b>05</b>Evaluation</span>
              <h2>Every participant is <em>measured</em>, not just attended</h2>
              <p>Each corporate training is tracked through the same evaluation stages, and the results are shared with your team.</p>
            </div>
            <ol className="ct-line">
              {STEPS.map(([t, d], i) => (
                <li key={t} className={i === STEPS.length - 1 ? 'is-final' : ''} data-fade>
                  <span className="ct-node" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <b>{t}</b><span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 6. Client feedback ── */}
        <section className="ct-section ct-paper" id="feedback">
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow"><b>06</b>Client feedback</span>
              <h2>What our corporate clients <em>wrote to us</em></h2>
              <p>Feedback letters and certificates received after training. Tap a letter to read it.</p>
            </div>
            <div className="ct-letters">
              {LETTERS.map(([f, n, d]) => (
                <button key={f} type="button" className="ct-letter" aria-label={`Read feedback from ${n}`} onClick={() => openSet(LETTERS.map(([lf, ln, ld]) => ({ src: IMG(`${lf}.jpg`), caption: `${ln} – ${ld}` })), LETTERS.findIndex(([lf]) => lf === f))} data-fade>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="ct-pg"><img src={IMG(`${f}.jpg`)} alt={`Feedback letter from ${n}`} loading="lazy" /></div>
                  <b>{n}</b><span>{d}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Enquiry ── */}
        <div className="ct-hazard" aria-hidden="true" />
        <section className="ct-section ct-dark" id="enquiry">
          <div className="ct-wrap">
            <div className="ct-enq">
              <div>
                <div className="ct-head" data-fade>
                  <span className="ct-eyebrow">Corporate enquiry</span>
                  <h2>Tell us what your <em>team needs</em></h2>
                  <p>Share a few details and our corporate training team will contact you with a proposal: syllabus, schedule and mode to fit your project.</p>
                </div>
                <div className="ct-contacts">
                  <div className="ct-contact"><span className="ct-ic">{Icon.phone}</span><div><b>Call or WhatsApp</b><a href="tel:+919821569885">+91 98215 69885</a><a href="tel:+919167219405">+91 91672 19405</a></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.mail}</span><div><b>Email</b><a href="mailto:enquiry@suvidya.ac.in">enquiry@suvidya.ac.in</a></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.pin}</span><div><b>Mumbai Branch</b><span>18/140, Anand Nagar, Nehru Road, Near Vakola Police Station, Vakola, Santacruz (East), Mumbai – 400 055</span></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.pin}</span><div><b>Pune Branch</b><span>303, Success Square, Karve Road, Paschimanagri, Kothrud, Pune – 411 038</span></div></div>
                </div>
              </div>

              <div className="ct-form" data-fade>
                {sent ? (
                  <div className="ct-done" role="status">
                    <span className="ct-tick">{Icon.tick}</span>
                    <h3>Thank you, we have your enquiry</h3>
                    <p>Our corporate training team will contact you shortly. For anything urgent, call +91 98215 69885.</p>
                    <button type="button" className="ct-btn ct-btn-indigo" onClick={() => { setForm(EMPTY_FORM); setSent(false); }}>Send another enquiry</button>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate>
                    <h3>Corporate training enquiry</h3>
                    <p className="ct-sub">Fields marked <span style={{ color: '#C0392B' }}>*</span> are required.</p>
                    <div className="ct-fgrid">
                      <label>Company name <i>*</i><input id="ct-company" value={form.company} onChange={set('company')} autoComplete="organization" /></label>
                      <label>Your name <i>*</i><input id="ct-name" value={form.name} onChange={set('name')} autoComplete="name" /></label>
                      <label>Designation<input id="ct-designation" value={form.designation} onChange={set('designation')} autoComplete="organization-title" /></label>
                      <label>City<input id="ct-city" value={form.city} onChange={set('city')} autoComplete="address-level2" /></label>
                      <label>Email <i>*</i><input id="ct-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
                      <label>Phone <i>*</i><input id="ct-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
                      <label>Training area<select id="ct-area" value={form.area} onChange={set('area')}>
                        <option>Engineering</option><option>Design &amp; Drafting</option><option>Software</option><option>Operation &amp; Maintenance</option><option>Specialised / Other</option>
                      </select></label>
                      <label>Where<select id="ct-mode" value={form.mode} onChange={set('mode')}>
                        <option value="site">At our site</option><option value="sit">At SIT</option><option value="online">Online</option>
                      </select></label>
                      <label>Freshers / GETs<input id="ct-freshers" type="number" min={0} inputMode="numeric" value={form.freshers} onChange={set('freshers')} placeholder="0" /></label>
                      <label>Experienced staff<input id="ct-experienced" type="number" min={0} inputMode="numeric" value={form.experienced} onChange={set('experienced')} placeholder="0" /></label>
                      <label className="ct-full">Topics or requirements<textarea id="ct-message" value={form.message} onChange={set('message')} placeholder="e.g. Pipe stress analysis with CAESAR II for 15 engineers, 10 days" /></label>
                      <label className="ct-hp" aria-hidden="true">Website<input id="ct-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
                    </div>
                    <div className="ct-form-foot">
                      <button type="submit" className="ct-btn ct-btn-indigo" disabled={sending}>{sending ? 'Sending…' : 'Send enquiry →'}</button>
                      {error && <p className="ct-err" role="alert">{error}</p>}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="ct-foot">
        <div className="ct-wrap">
          <div className="ct-foot-grid">
            <div>
              <p className="ct-foot-name">Suvidya Institute of Technology Pvt. Ltd.</p>
              <p>Suvidya Institute of Technology Pvt. Ltd. Making engineers and draughtsmen eligible for working in global industry.</p>
            </div>
            <div><b>Corporate Training</b><ul>{NAV.map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}<li><a href="#enquiry">Enquiry</a></li></ul></div>
            <div><b>More from SIT</b><ul>
              <li><a href="https://suvidya.ac.in/" target="_blank" rel="noopener noreferrer">suvidya.ac.in</a></li>
              <li><a href="https://suvidya.ac.in/aboutus/" target="_blank" rel="noopener noreferrer">About Us</a></li>
              <li><a href="https://suvidya.ac.in/placement/" target="_blank" rel="noopener noreferrer">Placements</a></li>
            </ul></div>
          </div>
          <div className="ct-foot-bottom"><span>© 2026 Suvidya Institute of Technology Pvt. Ltd.</span><span>ISO 9001:2015 · ECITB UK · NSDC Partner</span></div>
        </div>
      </footer>

      {shot && (
        <div className="ct-lb" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={(e) => { if (e.target === e.currentTarget) setShot(null); }}>
          <button type="button" className="ct-lb-close" aria-label="Close" onClick={() => setShot(null)} autoFocus>×</button>
          {photoSet.length > 1 && <button type="button" className="ct-lb-nav ct-lb-prev" aria-label="Previous photo" onClick={() => step(-1)}>‹</button>}
          {photoSet.length > 1 && <button type="button" className="ct-lb-nav ct-lb-next" aria-label="Next photo" onClick={() => step(1)}>›</button>}
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={shot.src} src={shot.src} alt={shot.caption} />
            <figcaption>{shot.caption}</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
