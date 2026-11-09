'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

/* Public corporate-training page. Content and photos come from suvidya.ac.in
   (corporate training, customers, feedback and events pages). Images live in
   /public/corporate-training. Enquiries post to /api/public/corporate-inquiry. */

const IMG = (f: string) => `/corporate-training/${f}`;

const CLIENT_LOGOS = ['27', '28-1', '29-1', '30-1', '33-1', '34', '35-1', '36-1', '62-1', '63-1', '64-1', '65-1', '72', '74', '75', '76', '77', '78', '79', '80', '81', '83', '84'];

const EVENTS = [
  { client: 'MAN Energy Solutions India Pvt. Ltd, Aurangabad', title: 'Instrumentation & Control Training', desc: 'Instrumentation and control engineering for the in-house engineering team.', pics: ['man1', 'man2', 'man3'] },
  { client: 'Tata Consulting Engineers Ltd, Jamshedpur', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: '2023–24 batch of 162 trainees, started July 2023.', pics: ['tcejam2', 'tcejam1', 'tcejam3'], mirror: true },
  { client: 'Tata Consulting Engineers Ltd, Pune', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: 'Job-ready discipline training for diploma holders joining TCE.', pics: ['tcepune1', 'tcepune2'] },
  { client: 'Tata Consulting Engineers Ltd, Mumbai', title: 'Piping, Electrical & Civil Training for Diploma Holders', desc: 'The diploma-holder programme, delivered for TCE Mumbai.', pics: ['tcemum1', 'tcemum2'] },
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

const ic = (d: React.ReactNode) => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const PROG_ICON: Record<string, React.ReactNode> = {
  'Piping & Process Engineering': ic(<><path d="M3 8h7a3 3 0 0 1 3 3v10" /><path d="M3 4h7a7 7 0 0 1 7 7v10" /><path d="M3 4v4M13 21h4" /></>),
  'Mechanical, Structural & MEP': ic(<><path d="M4 21V9l8-6 8 6v12" /><path d="M4 13h16M4 17h16M9 21V13M15 21V13" /></>),
  'Design & Drafting': ic(<><path d="M3 21h18" /><path d="m6 17 9-12 3 2-9 12-4 1z" /><path d="M13 7l3 2" /></>),
  'Engineering Software': ic(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="m9 8-2 2 2 2M15 8l2 2-2 2" /></>),
  'Operation & Maintenance': ic(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>),
  'Specialised Programmes': ic(<><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z" /><path d="m9 12 2 2 4-4" /></>),
};
const CATEGORIES = ['All', 'Engineering', 'Design & Drafting', 'Software', 'Operation & Maintenance', 'Others'];

const STEPS = [
  ['Pre-Test', 'Checks each participant’s starting level before training begins.'],
  ['Assessment', 'Regular checks of understanding during the programme.'],
  ['Assignments', 'Practical work based on real project activities.'],
  ['Training Material', 'Training material is provided as per your syllabus.'],
  ['Attendance', 'Recorded for every session.'],
  ['Final Exam', 'A closing test of what each participant has learned.'],
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
  ['#method', 'Training Method'],
  ['#evaluation', 'Evaluation'],
  ['#csr', 'Sample Productivity Report'],
  ['#feedback', 'Client Feedback'],
];


/* Sample productivity report: ILLUSTRATIVE figures only (no real client or batch data),
   showing the format of the progress report every corporate client receives. */

type Bar = { label: string; short?: string; note?: string; value: number; color?: string };
function BarChart({ data, max, unit, height = 220, ariaLabel }: { data: Bar[]; max: number; unit: string; height?: number; ariaLabel: string }) {
  const W = 100 * data.length + 40, H = height, top = 26, bottom = 40, left = 34;
  const plotH = H - top - bottom, slot = (W - left - 6) / data.length, bw = Math.min(56, slot * 0.56);
  const ticks = [0, max / 2, max];
  return (
    <svg className="ct-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t) => {
        const y = top + plotH - (t / max) * plotH;
        return (<g key={t}><line x1={left} x2={W - 6} y1={y} y2={y} className="ct-grid" /><text x={left - 8} y={y + 4} className="ct-tick" textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text></g>);
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH, x = left + slot * i + (slot - bw) / 2, y = top + plotH - h, r = Math.min(4, h / 2);
        return (
          <g key={d.label} className="ct-bar">
            <title>{`${d.label}${d.note ? ` (${d.note})` : ''}: ${d.value}${unit}`}</title>
            <rect x={left + slot * i} y={top} width={slot} height={plotH + bottom} fill="transparent" />
            <path d={`M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + plotH} Z`} fill={d.color || '#1C5DAA'} />
            <text x={x + bw / 2} y={y - 8} className="ct-val" textAnchor="middle">{d.value}</text>
            <text x={x + bw / 2} y={top + plotH + 18} className="ct-cat" textAnchor="middle">{d.short || d.label}</text>
          </g>
        );
      })}
      <line x1={left} x2={W - 6} y1={top + plotH} y2={top + plotH} className="ct-axis" />
    </svg>
  );
}

const STUDENTS = [
  { n: 'Trainee 1', pre: 9, post: 15 }, { n: 'Trainee 2', pre: 11, post: 16 }, { n: 'Trainee 3', pre: 8, post: 13 },
  { n: 'Trainee 4', pre: 12, post: 17 }, { n: 'Trainee 5', pre: 10, post: 14 }, { n: 'Trainee 6', pre: 13, post: 18 },
  { n: 'Trainee 7', pre: 9, post: 14 }, { n: 'Trainee 8', pre: 11, post: 15 },
];
const WEEKS = [{ label: 'Week 1', short: 'W1', value: 96 }, { label: 'Week 2', short: 'W2', value: 92 }, { label: 'Week 3', short: 'W3', value: 94 }, { label: 'Week 4', short: 'W4', value: 89 }, { label: 'Week 5', short: 'W5', value: 95 }, { label: 'Week 6', short: 'W6', value: 98 }];
const DEPTS = [{ l: 'Piping', v: 40, c: '#1C5DAA' }, { l: 'Process', v: 20, c: '#5F95D8' }, { l: 'Mechanical', v: 15, c: '#F2CF1F' }, { l: 'Electrical', v: 15, c: '#0A2342' }, { l: 'Civil', v: 10, c: '#A9C4EA' }];
const GRADES = [{ l: 'Distinction (75%+)', v: 9, c: '#1C5DAA' }, { l: 'First class (60–74%)', v: 14, c: '#5F95D8' }, { l: 'Pass (40–59%)', v: 4, c: '#F2CF1F' }, { l: 'Needs re-test', v: 1, c: '#C7CCDA' }];
const FEEDBACK = [{ l: 'Trainer knowledge', v: 4.8 }, { l: 'Relevance to projects', v: 4.6 }, { l: 'Course material', v: 4.4 }, { l: 'Practical exercises', v: 4.5 }, { l: 'Overall satisfaction', v: 4.7 }];

function StackedPrePost() {
  const max = 35, W = 640, H = 260, top = 20, bottom = 34, left = 30, plotH = H - top - bottom;
  const slot = (W - left - 6) / STUDENTS.length, bw = Math.min(40, slot * 0.55);
  return (
    <svg className="ct-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sample pre-test and post-test marks per trainee, stacked">
      {[0, 10, 20, 30].map((t) => { const y = top + plotH - (t / max) * plotH; return <g key={t}><line x1={left} x2={W - 6} y1={y} y2={y} className="ct-grid" /><text x={left - 8} y={y + 4} className="ct-tick" textAnchor="end">{t}</text></g>; })}
      {STUDENTS.map((s, i) => {
        const x = left + slot * i + (slot - bw) / 2, hPre = (s.pre / max) * plotH, hPost = (s.post / max) * plotH, yPre = top + plotH - hPre, yPost = yPre - hPost;
        return (
          <g key={s.n} className="ct-bar">
            <title>{`${s.n}: Pre-Test ${s.pre}, Post-Test ${s.post} (out of 20)`}</title>
            <path d={`M${x},${top + plotH} V${yPre} H${x + bw} V${top + plotH} Z`} fill="#A9C4EA" />
            <path d={`M${x},${yPre - 1} V${yPost + 4} Q${x},${yPost} ${x + 4},${yPost} H${x + bw - 4} Q${x + bw},${yPost} ${x + bw},${yPost + 4} V${yPre - 1} Z`} fill="#1C5DAA" />
            <text x={x + bw / 2} y={yPost - 7} className="ct-val" textAnchor="middle">+{s.post - s.pre}</text>
            <text x={x + bw / 2} y={top + plotH + 18} className="ct-cat" textAnchor="middle">{`T${i + 1}`}</text>
          </g>
        );
      })}
      <line x1={left} x2={W - 6} y1={top + plotH} y2={top + plotH} className="ct-axis" />
    </svg>
  );
}

function Donut({ data, label, centre, sub }: { data: { l: string; v: number; c: string }[]; label: string; centre: string; sub: string }) {
  const total = data.reduce((a, d) => a + d.v, 0), R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="ct-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={label}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="#EEF1F7" strokeWidth="30" />
        {data.map((d) => { const len = (d.v / total) * C, off = acc; acc += len; return (
          <circle key={d.l} cx="100" cy="100" r={R} fill="none" stroke={d.c} strokeWidth="30" strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 100 100)"><title>{`${d.l}: ${d.v}`}</title></circle>
        ); })}
        <text x="100" y="98" textAnchor="middle" className="ct-donut-c">{centre}</text>
        <text x="100" y="118" textAnchor="middle" className="ct-donut-s">{sub}</text>
      </svg>
      <ul className="ct-donut-key">{data.map((d) => <li key={d.l}><i style={{ background: d.c }} />{d.l}<b>{Math.round((d.v / total) * 100)}%</b></li>)}</ul>
    </div>
  );
}

/* Signature piece: an isometric plant blueprint that draws itself on scroll,
   with process flow running through the lines. Each station opens that
   programme area below. */
const PLANT: { id: string; cat: string; label: string; x: number; y: number; lx: number; ly: number; a?: 'start' | 'middle' | 'end' }[] = [
  { id: 'col', cat: 'Engineering', label: 'Process & Piping Engineering', x: 170, y: 120, lx: 214, ly: 274 },
  { id: 'rack', cat: 'Design & Drafting', label: 'Design & Drafting', x: 420, y: 92, lx: 434, ly: 100 },
  { id: 'pump', cat: 'Operation & Maintenance', label: 'Operation & Maintenance', x: 560, y: 300, lx: 574, ly: 292 },
  { id: 'tank', cat: 'Others', label: 'Fire, NDT & Offshore', x: 770, y: 150, lx: 770, ly: 124, a: 'middle' },
  { id: 'cr', cat: 'Software', label: 'E3D · PDMS · CAESAR II', x: 910, y: 265, lx: 960, ly: 214, a: 'end' },
];
const PIPES = [
  'M200 300 V350 H520',
  'M210 90 H300 V60 H560 V200',
  'M600 330 H700 V250',
  'M560 200 H700',
  'M820 320 V350 H880 V300',
  'M140 300 V370 H860',
];

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const k = Math.min((t - t0) / 1400, 1); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className="ct-countup">{v}</span>;
}

function PlantBlueprint({ cat, onPick }: { cat: string; onPick: (c: string) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`ct-plant${on ? ' is-on' : ''}`} data-fade>
      <div className="ct-plant-head">
        <span className="ct-plant-kicker">Explore by plant area</span>
        <span className="ct-plant-hint">Tap a station to see its programmes</span>
      </div>
      <svg ref={ref} viewBox="0 0 1000 420" role="group" aria-label="Interactive plant blueprint: choose a plant area to filter programmes">
        <defs>
          <pattern id="ct-bp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(169,196,234,.12)" strokeWidth="1" /></pattern>
          <pattern id="ct-bp-grid-l" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="rgba(169,196,234,.2)" strokeWidth="1" /></pattern>
        </defs>
        <rect width="1000" height="420" fill="url(#ct-bp-grid)" />
        <rect width="1000" height="420" fill="url(#ct-bp-grid-l)" />
        {/* equipment outlines */}
        <g className="ct-bp-eq">
          {/* distillation column */}
          <path pathLength={1} d="M140 300 V90 Q140 60 170 60 Q200 60 200 90 V300 Z" />
          <path pathLength={1} d="M140 130 H200 M140 170 H200 M140 210 H200 M140 250 H200" />
          {/* pipe rack */}
          <path pathLength={1} d="M330 60 V230 M480 60 V230 M630 60 V230 M310 120 H650 M310 160 H650" />
          {/* heat exchanger */}
          <path pathLength={1} d="M470 200 H650 Q680 200 680 220 Q680 240 650 240 H470 Q440 240 440 220 Q440 200 470 200 Z" />
          {/* pump */}
          <path pathLength={1} d="M530 330 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0 M504 356 H600 V370 H504 Z" />
          {/* storage tank */}
          <path pathLength={1} d="M700 150 Q770 125 840 150 V320 Q770 345 700 320 Z M700 150 Q770 175 840 150" />
          {/* control room */}
          <path pathLength={1} d="M860 230 H960 V300 H860 Z M875 245 H945 V280 H875 Z" />
        </g>
        {/* process lines */}
        <g className="ct-bp-pipes">{PIPES.map((d) => <path key={d} pathLength={1} d={d} />)}</g>
        <g className="ct-bp-flow">{PIPES.map((d) => <path key={d} d={d} />)}</g>
        {/* dimension callouts */}
        <g className="ct-bp-dim">
          <path d="M120 60 V300 M115 60 H125 M115 300 H125" /><text x="108" y="185" transform="rotate(-90 108 185)">EL +24.0 m</text>
          <text x="330" y="52">PIPE RACK · 6&quot; / 8&quot;</text>
          
        </g>
        {/* stations */}
        {PLANT.map((p) => {
          const sel = cat === p.cat;
          return (
            <g key={p.id} className={`ct-bp-st${sel ? ' is-sel' : ''}`} role="button" tabIndex={0} aria-pressed={sel} aria-label={`Show ${p.cat} programmes`}
              onClick={() => onPick(sel ? 'All' : p.cat)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(sel ? 'All' : p.cat); } }}>
              <circle className="ct-bp-ring" cx={p.x} cy={p.y} r="16" />
              <circle className="ct-bp-dot" cx={p.x} cy={p.y} r="7" />
              <text className="ct-bp-tag" x={p.lx} y={p.ly} textAnchor={p.a || 'start'}>{p.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="ct-plant-chips" role="group" aria-label="Plant areas">
        {PLANT.map((p) => <button key={p.id} type="button" aria-pressed={cat === p.cat} onClick={() => onPick(cat === p.cat ? 'All' : p.cat)}><i />{p.label}</button>)}
      </div>
      <div className="ct-plant-legend"><span><i className="is-eq" />Equipment</span><span><i className="is-flow" />Process flow</span><span><i className="is-st" />Training area</span></div>
    </div>
  );
}

function SampleReport() {
  const preAvg = STUDENTS.reduce((a, s) => a + s.pre, 0) / STUDENTS.length, postAvg = STUDENTS.reduce((a, s) => a + s.post, 0) / STUDENTS.length;
  const lift = Math.round(((postAvg - preAvg) / preAvg) * 100);
  const att = Math.round(WEEKS.reduce((a, w) => a + w.value, 0) / WEEKS.length);
  const passed = GRADES.slice(0, 3).reduce((a, g) => a + g.v, 0), all = GRADES.reduce((a, g) => a + g.v, 0);
  return (
    <div className="ct-report" data-fade>
      <div className="ct-report-head">
        <span className="ct-eyebrow">Sample Report · Based on Sample Data</span>
        <h3>The Report Your Company Receives After Every Training</h3>
        <p>Scores, attendance, participant mix, assessment results and feedback, all in one report, so the impact of the training is clear and measurable.</p>
      </div>
      <div className="ct-kpis">
        <div className="is-lift"><b>+<CountUp to={lift} />%</b><span>Rise in average score, Pre-Test to Post-Test</span></div>
        <div><b><CountUp to={att} />%</b><span>Average weekly attendance</span></div>
        <div><b><CountUp to={passed} />/{all}</b><span>Participants cleared the final assessment</span></div>
        <div><b>4.6/5</b><span>Average feedback rating</span></div>
      </div>
      <div className="ct-charts ct-charts-2">
        <figure className="ct-chart-card is-full">
          <figcaption><b>Pre-Test vs Post-Test, per Trainee</b><span>Marks out of 20, stacked</span></figcaption>
          <StackedPrePost />
          <div className="ct-legend"><span><i style={{ background: '#A9C4EA' }} />Pre-Test</span><span><i style={{ background: '#1C5DAA' }} />Post-Test</span></div>
        </figure>
        <figure className="ct-chart-card">
          <figcaption><b>Attendance per Week</b><span>% of participants present</span></figcaption>
          <BarChart data={WEEKS.map((w) => ({ ...w, color: w.value >= 95 ? '#1C5DAA' : '#5F95D8' }))} max={100} unit="%" height={240} ariaLabel="Sample weekly attendance percentages" />
        </figure>
        <figure className="ct-chart-card">
          <figcaption><b>Attendees by Department</b><span>Share of participants</span></figcaption>
          <Donut data={DEPTS} label="Sample split of attendees by department" centre={`${DEPTS.reduce((a, d) => a + d.v, 0)}`} sub="participants" />
        </figure>
        <figure className="ct-chart-card">
          <figcaption><b>Assessment Result</b><span>Final assessment grades</span></figcaption>
          <Donut data={GRADES} label="Sample final assessment grade distribution" centre={`${Math.round((passed / all) * 100)}%`} sub="passed" />
        </figure>
        <figure className="ct-chart-card">
          <figcaption><b>Feedback Analysis</b><span>Average rating out of 5</span></figcaption>
          <ul className="ct-fb">{FEEDBACK.map((f) => <li key={f.l}><span>{f.l}</span><div className="ct-fb-bar"><i style={{ width: `${(f.v / 5) * 100}%` }} /></div><b>{f.v.toFixed(1)}</b></li>)}</ul>
        </figure>
      </div>
      <em className="ct-sample-note">Illustrative figures based on sample data.</em>
    </div>
  );
}

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
  { file: 'ev2', tag: 'Corporate training', client: 'SIT corporate batch', seconds: 10 },
  { file: 'man3', tag: 'Instrumentation & Control', client: 'MAN Energy Solutions, Aurangabad', seconds: 6 },
  { file: 'tcemum1', tag: 'Piping · Electrical · Civil', client: 'Tata Consulting Engineers, Mumbai', seconds: 6 },
  { file: 'tcepune1', tag: 'Diploma holder programme', client: 'Tata Consulting Engineers, Pune', seconds: 6 },
  { file: 'tcejam2', tag: 'Diploma Holder Programme', client: 'Tata Consulting Engineers, Jamshedpur', seconds: 6 },
];

const HEADLINE = 'Training That Is a|Rehearsal of Actual Working|for Your Engineering Teams.'
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('');
  const [photoSet, setPhotoSet] = useState<Shot[]>([]);
  const openSet = (list: Shot[], i = 0) => { setPhotoSet(list); setShot(list[i]); };
  const step = (d: number) => { if (!shot || photoSet.length < 2) return; const i = photoSet.findIndex((x) => x.src === shot.src); setShot(photoSet[(i + d + photoSet.length) % photoSet.length]); };
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLDivElement>(null);
  const slideLetters = (d: number) => {
    const el = lettersRef.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.ct-letter');
    el.scrollBy({ left: d * ((card?.offsetWidth || 260) + 18) * 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

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
    const t = window.setTimeout(() => setReel((r) => (r + 1) % REEL.length), REEL[reel].seconds * 1000);
    return () => window.clearTimeout(t);
  }, [reel]);

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
      // depth: each section knows where it sits in the viewport (-1 above … 1 below) for parallax light layers
      root.querySelectorAll<HTMLElement>('.ct-section').forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        sec.style.setProperty('--rel', ((r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight).toFixed(3));
      });
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

  // Stats count up once when they come into view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'));
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target as HTMLElement; const end = Number(el.dataset.count); const t0 = performance.now(); const dur = 1600;
      const frame = (t: number) => { const k = Math.min((t - t0) / dur, 1); const v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = v.toLocaleString('en-IN'); if (k < 1) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    }), { threshold: 0.6 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Cinematic interaction: eased glide for in-page links and a soft light ripple on every click.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anim = 0;
    const scroller = () => (document.body.scrollHeight > document.body.clientHeight && getComputedStyle(document.body).overflowY !== 'visible' ? document.body : document.scrollingElement || document.documentElement) as HTMLElement;
    const ease = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
    const glideTo = (el: HTMLElement) => {
      const sc = scroller();
      const start = sc.scrollTop;
      const target = start + el.getBoundingClientRect().top - 84;
      const dist = target - start;
      const dur = Math.min(1600, 700 + Math.abs(dist) * 0.25);
      const t0 = performance.now();
      cancelAnimationFrame(anim);
      root.classList.add('is-gliding');
      const frame = (t: number) => {
        const k = Math.min((t - t0) / dur, 1);
        sc.scrollTop = start + dist * ease(k);
        if (k < 1) anim = requestAnimationFrame(frame);
        else { root.classList.remove('is-gliding'); el.classList.add('is-arrived'); window.setTimeout(() => el.classList.remove('is-arrived'), 1400); }
      };
      anim = requestAnimationFrame(frame);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const link = t.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link && link.getAttribute('href')!.length > 1) {
        const dest = document.querySelector<HTMLElement>(link.getAttribute('href')!);
        if (dest && !reduce) { e.preventDefault(); glideTo(dest); history.replaceState(null, '', link.getAttribute('href')!); }
      }
      const host = t.closest<HTMLElement>('.ct-btn, .ct-tab, .ct-film, .ct-prog, .ct-letter, .ct-zoom, .ct-strip-item, .ct-certs li, .ct-ledger-list li');
      if (host && !reduce) {
        const r = host.getBoundingClientRect();
        const dot = document.createElement('span');
        dot.className = 'ct-ripple';
        const size = Math.max(r.width, r.height) * 2.2;
        dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(dot);
        window.setTimeout(() => dot.remove(), 900);
      }
    };
    root.addEventListener('click', onClick);
    return () => { root.removeEventListener('click', onClick); cancelAnimationFrame(anim); };
  }, []);

  // Scrollspy: highlight the nav link for the section in view.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const ids = NAV.map(([h]) => h.slice(1));
    const seen = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      let best = ''; let ratio = 0;
      ids.forEach((id) => { const r = seen.get(id) || 0; if (r > ratio) { ratio = r; best = id; } });
      setActive(ratio > 0 ? best : '');
    }, { rootMargin: '-35% 0px -50% 0px', threshold: [0, 0.01, 0.25, 0.5, 1] });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
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
      if (!res.ok) throw new Error(data.error || 'We could not send your enquiry. Please call +91 91672 19401.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your enquiry. Please call +91 91672 19401.');
    } finally { setSending(false); }
  }

  const progs = PROGRAMMES.filter((p) => cat === 'All' || p.cat === cat);

  // ThreeUI-style pointer light: cards get a rim glow that follows the cursor,
  // feature cards tilt slightly, primary CTAs lean towards the pointer.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const LIT = '.ct-track, .ct-prog, .ct-chart-card, .ct-letter, .ct-pr, .ct-kpis > div, .ct-film';
    const onMove = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>(LIT);
      if (card) {
        const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', `${x}px`); card.style.setProperty('--my', `${y}px`);
        if (card.matches('.ct-track, .ct-chart-card')) {
          card.style.setProperty('--rx', `${((y / r.height) - 0.5) * -4}deg`); card.style.setProperty('--ry', `${((x / r.width) - 0.5) * 4}deg`);
        }
      }
      const btn = t.closest<HTMLElement>('.ct-btn-yellow, .ct-btn-indigo');
      if (btn) { const r = btn.getBoundingClientRect(); btn.style.setProperty('--bx', `${(e.clientX - r.left - r.width / 2) * 0.18}px`); btn.style.setProperty('--by', `${(e.clientY - r.top - r.height / 2) * 0.3}px`); }
    };
    const onLeave = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches?.('.ct-track, .ct-chart-card')) { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }
      if (el.matches?.('.ct-btn-yellow, .ct-btn-indigo')) { el.style.removeProperty('--bx'); el.style.removeProperty('--by'); }
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerout', onLeave, { passive: true });
    return () => { root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerout', onLeave); };
  }, []);

  return (
    <div className="ct" ref={rootRef}>
      <div className="ct-progress" aria-hidden="true" />
      <div className="ct-grain" aria-hidden="true" />
      {/* ── Nav ── */}
      <header className={`ct-nav${scrolled ? ' is-scrolled' : ''}${pastHero ? ' is-past' : ''}`}>
        <div className="ct-wrap">
          <a className="ct-brand" href="#top" aria-label="SIT Corporate Training, top of page">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG('sit-logo.png')} alt="SIT, Suvidya Institute of Technology" />
            <span className="ct-brand-text"><b>Suvidya Institute of Technology Pvt. Ltd.</b><span>Corporate Training</span></span>
          </a>
          <ul className="ct-links">{NAV.map(([h, l]) => <li key={h}><a href={h} className={active === h.slice(1) ? 'is-active' : undefined} aria-current={active === h.slice(1) ? 'true' : undefined}>{l}</a></li>)}</ul>
          <a className="ct-btn ct-btn-indigo ct-nav-cta" href="#enquiry">Enquire Now</a>
          <button type="button" className="ct-menu-btn" aria-expanded={menuOpen} aria-controls="ct-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
        <div id="ct-menu" className="ct-menu" hidden={!menuOpen}>
          <ul>{NAV.map(([h, l]) => <li key={h}><a href={h} className={active === h.slice(1) ? 'is-active' : undefined} onClick={() => setMenuOpen(false)}>{l}</a></li>)}</ul>
          <a className="ct-btn ct-btn-yellow" href="#enquiry" onClick={() => setMenuOpen(false)}>Enquire Now</a>
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
          <div className="ct-wrap">
            <div className="ct-hero-grid">
              <div>
                <div className="ct-since"><b>24+ Years</b> of Corporate Training across India &amp; abroad</div>
                <h1 aria-label="Training That Is a Rehearsal of Actual Working for Your Engineering Teams.">
                  {HEADLINE.map((w, i) => (
                    <span key={i} aria-hidden="true">
                      <span className={`ct-word${w.hi ? ' is-hi' : ''}`} style={{ animationDelay: `${0.15 + i * 0.07}s` }}>{w.t}</span>{' '}
                    </span>
                  ))}
                </h1>
                <p className="ct-lede">Upskill your engineering workforce with <strong>customised training for company employees</strong>, designed around your live projects in engineering design, procurement, construction, operation and maintenance.</p>
                <div className="ct-cta">
                  <a className="ct-btn ct-btn-yellow" href="#enquiry">Plan a Training →</a>
                  <a className="ct-btn ct-btn-line" href="#conducted">See Trainings Conducted</a>
                </div>
              </div>
            </div>
            <div className="ct-credit" aria-live="off">
              <b>{REEL[reel].tag}</b>{REEL[reel].client}
              <div className="ct-dots">{REEL.map((r, i) => <i key={r.file} className={i === reel ? 'is-on' : ''} style={{ animationDuration: `${r.seconds}s` }} />)}</div>
            </div>
            <div className="ct-stats">
              <div className="ct-stat"><b><span data-count="250">250</span><i>+</i></b><span>Corporate trainings delivered for EPC companies, refineries, chemical plants and government bodies</span></div>
              <div className="ct-stat"><b><span data-count="21000">21,000</span><i>+</i></b><span>Engineers and draughtsmen trained for industry</span></div>
              <div className="ct-stat"><b><span data-count="39">39</span><i>+</i></b><span>Nationalities trained by SIT</span></div>
              <div className="ct-stat"><b><span data-count="20">20</span><i>+</i></b><span>Years of industry experience behind every trainer</span></div>
            </div>
          </div>
        </section>
        {/* ── Client logos ── */}
        <div className="ct-ticker" aria-label="Some of our corporate clients">
          <p className="ct-ticker-label">Trusted by leading international &amp; Indian companies</p>
          <div className="ct-ticker-track">
            {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((n, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={IMG(`cl-${n}.png`)} alt={i < CLIENT_LOGOS.length ? 'Corporate client logo' : ''} loading="lazy" />
            ))}
          </div>
        </div>

        {/* ── 1. Trainings conducted ── */}
        <section className="ct-section ct-paper" id="conducted" style={{ background: 'var(--paper-2)' }}>
          <div className="ct-wrap">
            <div className="ct-head" data-fade data-num="01">
              <span className="ct-eyebrow"><b>01</b>Trainings conducted</span>
              <h2>Corporate Trainings <em>We Have Delivered</em></h2>
              <p>Leading engineering companies return to SIT year after year. Every programme here was delivered on site or at SIT, with a syllabus built for that team.</p>
            </div>
            <div className="ct-films">
              {EVENTS.map((ev) => (
                <button
                  type="button"
                  className={`ct-film${(ev as { mirror?: boolean }).mirror ? ' is-mirror' : ''}`}
                  key={ev.client}
                  data-fade
                  aria-label={`View photos: ${ev.client}: ${ev.title}`}
                  onClick={() => openSet(ev.pics.map((p) => ({ src: IMG(`${p}.jpg`), caption: `${ev.client}: ${ev.title}` })))}
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
              <ul className="ct-ledger-list" tabIndex={0} aria-label="Other trainings delivered (scroll for more)">
                {MORE_EVENTS.map(([c, t]) => <li key={c + t}><b>{t}</b><span>{c}</span></li>)}
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
            <div className="ct-tailor" data-fade>
              <div className="ct-tailor-main">
                <span className="ct-eyebrow">Built around your team</span>
                <p className="ct-tailor-line"><mark>Training Will Be Provided as per Your Syllabus and Training Level.</mark></p>
                <p className="ct-tailor-sub">No off-the-shelf courses. Tell us what your engineers work on and we shape the syllabus, depth and pace to match, from new graduates to senior professionals.</p>
                <a className="ct-btn ct-btn-indigo" href="#enquiry">Request a sample syllabus →</a>
              </div>
              <ol className="ct-tailor-steps">
                <li><span>1</span><b>Share Your Requirements</b><em>Tell us the topics, tools and project activities your team works on.</em></li>
                <li><span>2</span><b>Tailored Syllabus and Level</b><em>We design the syllabus and set the depth: foundation, intermediate or advanced.</em></li>
                <li><span>3</span><b>Training Delivered</b><em>At your site, at SIT or online, with progress measured throughout.</em></li>
                <li><span>4</span><b>Increased Team Productivity</b><em>Your engineers apply new skills on live projects and deliver more, sooner.</em></li>
              </ol>
            </div>
          </div>
        </section>

        {/* ── Accreditation ── */}
        <section className="ct-section ct-paper" id="about">
          <div className="ct-wrap">
            <div className="ct-head" data-fade>
              <span className="ct-eyebrow">Accreditation &amp; association</span>
              <h2>Certified, Affiliated and <em>Trusted by Industry</em></h2>
              <p>Recognised in India and internationally, SIT prepares engineers and draughtsmen to work in global industry. Your corporate programme carries the same accreditation as our professional courses.</p>
            </div>
            <ul className="ct-certs">
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-ecitb.png')} alt="ECITB logo" loading="lazy" /></span>
                <b>ECITB, United Kingdom</b><span>Affiliated for Plant Layout Design training</span>
              </li>
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-iso.png')} alt="ISO 9001:2015 certification mark, Bureau of Indian Standards" loading="lazy" /></span>
                <b>ISO 9001:2015</b><span>Certified by Bureau of Indian Standards</span>
              </li>
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-maccia.png')} alt="MACCIA logo" loading="lazy" /></span>
                <b>Maharashtra Chamber of Commerce</b><span>Member, apex chamber of Maharashtra State</span>
              </li>
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-cii.png')} alt="Confederation of Indian Industry logo" loading="lazy" /></span>
                <b>Confederation of Indian Industry</b><span>Member</span>
              </li>
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-msme-wide.png')} alt="MSME, Ministry of Micro, Small and Medium Enterprises logo" loading="lazy" /></span>
                <b>MSME Registered</b><span>Ministry of Micro, Small and Medium Enterprises</span>
              </li>
              <li data-fade>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ct-cert-logo"><img src={IMG('cert-giz.png')} alt="GIZ, Deutsche Gesellschaft für Internationale Zusammenarbeit logo" loading="lazy" /></span>
                <b>Fit for Partnership with Germany</b><span>Certified under the GIZ programme</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ── 2. Programmes ── */}
        <section className="ct-section ct-paper" id="programmes">
          <div className="ct-wrap">
            <div className="ct-head" data-fade data-num="02">
              <span className="ct-eyebrow"><b>02</b>New training programmes</span>
              <h2>Programmes for <em>Every Engineering Team</em></h2>
              <p>From engineering and drafting to software and plant operation, pick a ready programme or combine topics into one tailored course. Software is always taught with the engineering concepts, codes and standards behind it.</p>
            </div>
            <PlantBlueprint cat={cat} onPick={setCat} />
            <div className="ct-tabs" role="tablist" aria-label="Programme area">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" role="tab" className="ct-tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="ct-progs">
              {progs.map((p) => (
                <article className="ct-prog" key={p.title}>
                  <div className="ct-prog-top">
                    <span className="ct-prog-icon" aria-hidden="true">{PROG_ICON[p.title]}</span>
                    <span className="ct-prog-cat">{p.cat}</span>
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

        {/* ── 4. Training method ── */}
        <section className="ct-section ct-paper" id="method">
          <div className="ct-wrap">
            <div className="ct-head" data-fade data-num="03">
              <span className="ct-eyebrow"><b>03</b>Training method</span>
              <h2>A Holistic Training Method That Makes Employees <em>Productive from Day One</em></h2>
              <p>Our Employability Skill Enhancing Training Program brings concepts, codes, software and hands-on project work together, so your people contribute to live projects sooner.</p>
            </div>
            <div className="ct-tracks">
              <div className="ct-track" data-fade><div className="ct-track-top"><span className="ct-tag ct-tag-pill">For Graduate Trainee Engineers</span></div><h3><mark>Case-Study Training from Concept to Commissioning</mark></h3><p>To bring new engineers into working in the shortest time, they are trained and guided through the project activities done regularly from concept to commissioning, using case studies.</p></div>
              <div className="ct-track" data-fade><div className="ct-track-top"><span className="ct-tag ct-tag-pill">For Experienced Professionals</span></div><h3><mark>Custom-Made Training Based on Your Projects</mark></h3><p>Engineers who have worked on projects for years sharpen their skills in new technologies, concepts, codes and standards, and statutory requirements. Topics are collected from the working team, so the training reduces mistakes on real projects.</p></div>
            </div>
            <div className="ct-principles">
              <div className="ct-pr" data-fade><b>Rehearsal of actual working</b><span>Training mirrors the activities your team performs on projects.</span></div>
              <div className="ct-pr" data-fade><b>Manual work first</b><span>Participants work by hand to visualise the system and understand the concept, which builds confidence.</span></div>
              <div className="ct-pr" data-fade><b>Codes &amp; standards</b><span>Detailed concept engineering with the relevant codes and standards.</span></div>
              <div className="ct-pr" data-fade><b>Industry software</b><span>PDMS, E3D, CAESAR II, AutoCAD and more, taught with the engineering concepts.</span></div>
            </div>
            <div className="ct-banner" data-fade>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG('tcepune2.jpg')} alt="Classroom training for Tata Consulting Engineers trainees, Pune" loading="lazy" />
              <div className="ct-banner-copy">
                <p className="ct-banner-kicker">Our Trainers</p>
                <p className="ct-banner-title">Engineers Training Engineers.</p>
                <p>Every SIT trainer is a retired, experienced engineering professional. They teach the way projects are actually run, so your engineers walk out ready for real work.</p>
                <p>Their purpose is simple: to pass a career’s worth of experience and knowledge on to the next generation of engineers.</p>
                <ul className="ct-banner-points">
                  <li>Retired industry professionals</li>
                  <li>Project-ready teaching</li>
                  <li>Mentors for the next generation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Evaluation ── */}
        <section className="ct-section ct-paper" id="evaluation" style={{ background: 'var(--paper-2)' }}>
          <div className="ct-wrap">
            <div className="ct-head" data-fade data-num="04">
              <span className="ct-eyebrow"><b>04</b>Evaluation</span>
              <h2>Progress and Effectiveness of Training Is <em>Measured</em>, Not Just Conducted</h2>
              <p>Every corporate training follows the same clear evaluation stages, and you receive the results, so you can see exactly what your investment delivered.</p>
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

        {/* ── 5. Sample progress reports ── */}
        <section className="ct-section ct-dark" id="csr">
          <div className="ct-wrap">
            <div className="ct-csr-grid">
              <div data-fade>
                <div className="ct-head" data-num="05" style={{ marginBottom: 0 }}>
                  <span className="ct-eyebrow"><b>05</b>Sample Productivity Report · Tata Consulting Engineers</span>
                  <h2>Skilling Diploma Holders with <em>Tata Consulting Engineers</em></h2>
                  <p>For Tata Consulting Engineers, SIT turns diploma holders into job-ready talent in piping, electrical and civil engineering. The programme has been delivered at TCE’s Jamshedpur, Pune and Mumbai locations.</p>
                </div>
                <div className="ct-csr-nums">
                  <div><b>162</b><span>trainees in the Jamshedpur 2023–24 batch</span></div>
                  <div><b>3</b><span>disciplines: piping, electrical, civil</span></div>
                  <div><b>3</b><span>locations: Jamshedpur, Pune, Mumbai</span></div>
                </div>
                <div className="ct-chips"><span>Piping</span><span>Electrical</span><span>Civil</span><span>Diploma holders</span></div>
              </div>
              <div className="ct-csr-pics" data-fade>
                <Zoom file="tcejam3" caption="TCE Jamshedpur: piping session" onOpen={setShot} />
                <Zoom file="tcejam1" caption="TCE Jamshedpur: batch completion" onOpen={setShot} />
                <Zoom file="tcemum2" caption="TCE Mumbai: diploma holder training" onOpen={setShot} />
              </div>
            </div>
            <SampleReport />
          </div>
        </section>

        {/* ── 6. Client feedback ── */}
        <section className="ct-section ct-light" id="feedback">
          <div className="ct-wrap">
            <div className="ct-head" data-fade data-num="06">
              <span className="ct-eyebrow"><b>06</b>Client feedback</span>
              <h2>What Our Corporate Clients <em>Wrote to Us</em></h2>
              <p>Real letters and certificates from the companies we have trained. Tap any letter to read it in full.</p>
            </div>
            <div className="ct-carousel-nav">
              <button type="button" aria-label="Previous letters" onClick={() => slideLetters(-1)}>←</button>
              <button type="button" aria-label="Next letters" onClick={() => slideLetters(1)}>→</button>
            </div>
            <div className="ct-letters ct-carousel" ref={lettersRef} tabIndex={0} aria-label="Client feedback letters, scroll sideways">
              {LETTERS.map(([f, n, d]) => (
                <button key={f} type="button" className="ct-letter" aria-label={`Read feedback from ${n}`} onClick={() => openSet(LETTERS.map(([lf, ln, ld]) => ({ src: IMG(`${lf}.jpg`), caption: `${ln} · ${ld}` })), LETTERS.findIndex(([lf]) => lf === f))} data-fade>
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
                  <h2>Tell Us What Your <em>Team Needs</em></h2>
                  <p>Share a few details and our corporate training team will send you a tailored proposal, with syllabus, schedule and training mode to fit your project.</p>
                </div>
                <div className="ct-contacts">
                  <div className="ct-contact"><span className="ct-ic">{Icon.phone}</span><div><b>Call or WhatsApp</b><a href="tel:+919167219401">+91 91672 19401</a></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.mail}</span><div><b>Email</b><a href="mailto:enquiry@suvidya.ac.in">enquiry@suvidya.ac.in</a></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.pin}</span><div><b>Mumbai Branch</b><span>18/140, Anand Nagar, Nehru Road, Near Vakola Police Station, Vakola, Santacruz (East), Mumbai 400 055</span></div></div>
                  <div className="ct-contact"><span className="ct-ic">{Icon.pin}</span><div><b>Pune Branch</b><span>303, Success Square, Karve Road, Paschimanagri, Kothrud, Pune 411 038</span></div></div>
                </div>
              </div>

              <div className="ct-form" data-fade>
                {sent ? (
                  <div className="ct-done" role="status">
                    <span className="ct-tick">{Icon.tick}</span>
                    <h3>Thank You, We Have Your Enquiry</h3>
                    <p>Our corporate training team will be in touch shortly. For anything urgent, call +91 91672 19401.</p>
                    <button type="button" className="ct-btn ct-btn-indigo" onClick={() => { setForm(EMPTY_FORM); setSent(false); }}>Send another enquiry</button>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate>
                    <h3>Corporate Training Enquiry</h3>
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
                        <option value="site">At company&apos;s site</option><option value="sit">At SIT</option><option value="online">Online</option>
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
          <div className="ct-foot-cta">
            <div>
              <p className="ct-foot-kicker">Corporate training</p>
              <p className="ct-foot-cta-line">Plan a Training for Your Team, Built Around Your Syllabus and Level.</p>
            </div>
            <div className="ct-foot-cta-actions">
              <a className="ct-btn ct-btn-yellow" href="#enquiry">Enquire Now →</a>
              <a className="ct-foot-phone" href="tel:+919167219401">+91 91672 19401</a>
            </div>
          </div>

          <div className="ct-foot-grid">
            <div className="ct-foot-brand">
              <p className="ct-foot-name">Suvidya Institute of Technology Pvt. Ltd.</p>
              <p className="ct-foot-tag">Making engineers and draughtsmen eligible for working in global industry, with <b>Engineers Training Engineers</b> for 24+ years.</p>
              <div className="ct-foot-certs" aria-label="Accreditations">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-ecitb.png')} alt="ECITB, United Kingdom" loading="lazy" /></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-iso.png')} alt="ISO 9001:2015, Bureau of Indian Standards" loading="lazy" /></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-maccia.png')} alt="MACCIA member" loading="lazy" /></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-cii.png')} alt="CII member" loading="lazy" /></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-msme-wide.png')} alt="MSME registered" loading="lazy" /></span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span><img src={IMG('cert-giz.png')} alt="Fit for Partnership with Germany (GIZ)" loading="lazy" /></span>
              </div>
            </div>
            <nav className="ct-foot-col" aria-label="On this page">
              <b>Explore</b>
              <ul>{NAV.map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}<li><a href="#enquiry">Enquiry</a></li></ul>
            </nav>
            <div className="ct-foot-col">
              <b>Contact</b>
              <ul className="ct-foot-contact">
                <li><span>Phone / WhatsApp</span><a href="tel:+919167219401">+91 91672 19401</a></li>
                <li><span>Email</span><a href="mailto:enquiry@suvidya.ac.in">enquiry@suvidya.ac.in</a></li>
                <li><span>Mumbai</span>18/140, Anand Nagar, Nehru Road, Vakola, Santacruz (East), Mumbai 400 055</li>
                <li><span>Pune</span>303, Success Square, Karve Road, Kothrud, Pune 411 038</li>
              </ul>
            </div>
            <div className="ct-foot-col">
              <b>More from SIT</b>
              <ul>
                <li><a href="https://suvidya.ac.in/" target="_blank" rel="noopener noreferrer">suvidya.ac.in ↗</a></li>
                <li><a href="https://suvidya.ac.in/aboutus/" target="_blank" rel="noopener noreferrer">About Us ↗</a></li>
                <li><a href="https://suvidya.ac.in/placement/" target="_blank" rel="noopener noreferrer">Placements ↗</a></li>
              </ul>
            </div>
          </div>

          <div className="ct-foot-bottom">
            <span>© 2026 Suvidya Institute of Technology Pvt. Ltd. All rights reserved.</span>
            <span>ISO 9001:2015 certified · ECITB UK affiliated</span>
          </div>
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
