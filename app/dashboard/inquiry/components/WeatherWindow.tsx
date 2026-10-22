'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Short, original lines (no attributions to get wrong) — the cat reads them out.
const QUOTES = [
  'Every follow-up is a small promise kept. Keep a few more today.',
  'The student who says "maybe" is still listening. Call them back.',
  'Good counselling is mostly good listening, with a clear next step at the end.',
  'Someone on your list is waiting for exactly the call you are about to make.',
  'Progress is quiet: one more conversation, one more date in the diary.',
  'A lead is a person with a plan that has not met the right batch yet.',
  'Be patient with the slow days. The admissions come from the steady ones.',
  'Clarity closes more doors than pressure ever opens. Explain it simply.',
  'Today\'s follow-up is next month\'s admission. Make it count.',
  'Start with the lead you are most nervous to call. The rest will feel easy.',
  'Treat every inquiry like it is the one that changes someone\'s career.',
  'Consistency beats intensity. Show up for your list again today.',
];

const CITY = 'Mumbai';
const COORDS = { lat: 19.076, lon: 72.8777 };

type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
interface Weather { sky: Sky; temp: number | null; isDay: boolean }

/** WMO weather codes → a scene. */
function skyOf(code: number): Sky {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}
const LABEL: Record<Sky, string> = {
  clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Overcast', fog: 'Foggy', drizzle: 'Drizzle', rain: 'Rainy', snow: 'Snowy', storm: 'Thunderstorm',
};

const W = 64;
const H = 48;
const PALETTE = {
  wall: '#EFE6D6', wallDark: '#E3D8C4', frame: '#8B5E3C', frameDark: '#6B4429', sill: '#A8754B',
  cat: '#E8A04C', catDark: '#C47A2B', catLight: '#F6D2A0', ink: '#2B2118', pink: '#F29CB0',
  pot: '#C1623B', leaf: '#4E9A4B', leafDark: '#3A7B3A', curtain: '#E58F7B', curtainDark: '#C96E5B',
};
const SKY_COLOR: Record<Sky, [string, string]> = {
  clear: ['#7CC8FF', '#1B2A52'], partly: ['#8FCBF5', '#222E52'], cloudy: ['#A7B4C2', '#2A3144'], fog: ['#CAD0D8', '#3A4152'],
  drizzle: ['#8D9DB1', '#26304A'], rain: ['#76879E', '#202A42'], snow: ['#C4D3E3', '#2F3B55'], storm: ['#4B5068', '#14182A'],
};

// Window geometry (logical pixels).
const WIN = { x: 6, y: 5, w: 34, h: 30 };
const GLASS = { x: WIN.x + 2, y: WIN.y + 2, w: WIN.w - 4, h: WIN.h - 4 };

export default function WeatherWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weather, setWeather] = useState<Weather>({ sky: 'clear', temp: null, isDay: true });
  const [loaded, setLoaded] = useState(false);
  const [quote, setQuote] = useState(() => {
    const d = new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000) % QUOTES.length;
  });
  const [paused, setPaused] = useState(false);

  // Mutable animation state — kept out of React state so the canvas loop never re-renders.
  const anim = useRef({ open: false, hop: 0, hearts: [] as { x: number; y: number; t: number }[], mouseX: 0.5, flash: 0, frame: 0 });
  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Live weather — Open-Meteo, no key needed. Refreshes every 15 minutes.
  useEffect(() => {
    let active = true;
    const load = () => {
      const { lat, lon } = COORDS;
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`)
        .then((r) => r.json())
        .then((d) => {
          if (!active || !d?.current) return;
          setWeather({ sky: skyOf(Number(d.current.weather_code)), temp: Math.round(Number(d.current.temperature_2m)), isDay: d.current.is_day === 1 });
          setLoaded(true);
        })
        .catch(() => { if (active) setLoaded(true); });
    };
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Rotate the cat's quote.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setQuote((i) => (i + 1) % QUOTES.length), 8000);
    return () => clearInterval(t);
  }, [paused, quote]);

  // ── Drawing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const inGlass = (x: number, y: number) => x >= GLASS.x && x < GLASS.x + GLASS.w && y >= GLASS.y && y < GLASS.y + GLASS.h;
    const gpx = (x: number, y: number, w: number, h: number, c: string) => { // clipped to the glass
      const x0 = Math.max(x, GLASS.x), y0 = Math.max(y, GLASS.y), x1 = Math.min(x + w, GLASS.x + GLASS.w), y1 = Math.min(y + h, GLASS.y + GLASS.h);
      if (x1 > x0 && y1 > y0) px(x0, y0, x1 - x0, y1 - y0, c);
    };

    // Stable pseudo-random particles.
    const rand = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

    const cloud = (cx: number, cy: number, c: string, shade: string) => {
      gpx(cx, cy + 2, 10, 3, c); gpx(cx + 2, cy, 6, 3, c); gpx(cx + 6, cy + 1, 4, 2, c); gpx(cx, cy + 4, 10, 1, shade);
    };

    const draw = () => {
      const a = anim.current;
      const wx = weatherRef.current;
      const f = a.frame++;
      const t = f / 30;
      const [dayC, nightC] = SKY_COLOR[wx.sky];
      const sky = wx.isDay ? dayC : nightC;

      // wall
      px(0, 0, W, H, PALETTE.wall);
      for (let y = 0; y < H; y += 4) px(0, y, W, 1, PALETTE.wallDark);

      // sky
      px(GLASS.x, GLASS.y, GLASS.w, GLASS.h, sky);
      if (!wx.isDay || wx.sky === 'storm') px(GLASS.x, GLASS.y + GLASS.h - 6, GLASS.w, 6, wx.isDay ? '#3C4160' : '#26305A');

      // celestial body
      if (wx.sky === 'clear' || wx.sky === 'partly') {
        if (wx.isDay) {
          const sx = GLASS.x + 22, sy = GLASS.y + 7;
          px(sx - 3, sy - 4, 7, 9, '#FFD84A'); px(sx - 4, sy - 3, 9, 7, '#FFD84A'); px(sx - 2, sy - 3, 5, 7, '#FFE98A');
          if (Math.floor(t * 2) % 2 === 0) { px(sx, sy - 7, 1, 2, '#FFD84A'); px(sx, sy + 6, 1, 2, '#FFD84A'); px(sx - 7, sy, 2, 1, '#FFD84A'); px(sx + 6, sy, 2, 1, '#FFD84A'); }
          else { px(sx - 6, sy - 6, 1, 1, '#FFD84A'); px(sx + 6, sy - 6, 1, 1, '#FFD84A'); px(sx - 6, sy + 6, 1, 1, '#FFD84A'); px(sx + 6, sy + 6, 1, 1, '#FFD84A'); }
        } else {
          const mx = GLASS.x + 21, my = GLASS.y + 6;
          px(mx, my, 6, 6, '#F4F1D0'); px(mx - 1, my + 1, 8, 4, '#F4F1D0'); px(mx + 2, my, 5, 5, nightC); // crescent
          for (let i = 0; i < 9; i++) {
            if (Math.floor(t * 1.5 + i) % 3 === 0) continue; // twinkle
            gpx(GLASS.x + 2 + Math.floor(rand(i + 1) * (GLASS.w - 4)), GLASS.y + 2 + Math.floor(rand(i + 20) * 14), 1, 1, '#FFFFFF');
          }
        }
      }

      // clouds drifting
      const cloudCount = { clear: 0, partly: 2, cloudy: 4, fog: 2, drizzle: 3, rain: 4, snow: 3, storm: 4 }[wx.sky];
      const cMain = wx.sky === 'storm' ? '#5C627E' : wx.sky === 'rain' || wx.sky === 'drizzle' ? '#9BA8BA' : wx.isDay ? '#FFFFFF' : '#59638A';
      const cShade = wx.sky === 'storm' ? '#454A63' : wx.sky === 'rain' || wx.sky === 'drizzle' ? '#7F8CA0' : wx.isDay ? '#DDE6EF' : '#454E73';
      for (let i = 0; i < cloudCount; i++) {
        const speed = 0.9 + i * 0.35;
        const span = GLASS.w + 16;
        const x = GLASS.x - 12 + ((t * speed * 2 + i * 13) % span);
        cloud(Math.round(x), GLASS.y + 2 + i * 5 - (i % 2) * 2, cMain, cShade);
      }

      // precipitation
      if (wx.sky === 'rain' || wx.sky === 'storm' || wx.sky === 'drizzle') {
        const n = wx.sky === 'drizzle' ? 10 : 22;
        for (let i = 0; i < n; i++) {
          const x = GLASS.x + Math.floor(rand(i + 3) * GLASS.w);
          const y = GLASS.y + ((rand(i + 50) * GLASS.h + t * (wx.sky === 'drizzle' ? 14 : 30)) % GLASS.h);
          gpx(x, Math.round(y), 1, 2, '#BFE0FF');
        }
        // splashes on the sill
        if (f % 8 < 4) for (let i = 0; i < 4; i++) gpx(GLASS.x + Math.floor(rand(i + 90 + Math.floor(f / 8)) * GLASS.w), GLASS.y + GLASS.h - 1, 1, 1, '#DFF0FF');
      }
      if (wx.sky === 'snow') {
        for (let i = 0; i < 20; i++) {
          const x = GLASS.x + ((rand(i + 7) * GLASS.w + Math.sin(t + i) * 2 + GLASS.w) % GLASS.w);
          const y = GLASS.y + ((rand(i + 60) * GLASS.h + t * 6) % GLASS.h);
          gpx(Math.round(x), Math.round(y), 1, 1, '#FFFFFF');
        }
      }
      if (wx.sky === 'fog') for (let i = 0; i < 4; i++) { const ox = Math.round(Math.sin(t * 0.6 + i) * 3); gpx(GLASS.x + ox, GLASS.y + 8 + i * 6, GLASS.w, 3, 'rgba(235,238,242,0.65)'); }
      if (wx.sky === 'storm') {
        if (a.flash <= 0 && f % 150 === 0) a.flash = 7;
        if (a.flash > 0) {
          a.flash--;
          if (a.flash > 3) px(GLASS.x, GLASS.y, GLASS.w, GLASS.h, 'rgba(255,255,255,0.75)');
          gpx(GLASS.x + 20, GLASS.y + 8, 2, 5, '#FFF27A'); gpx(GLASS.x + 18, GLASS.y + 12, 3, 2, '#FFF27A'); gpx(GLASS.x + 19, GLASS.y + 14, 2, 5, '#FFF27A');
        }
      }

      // window frame + mullions
      px(WIN.x, WIN.y, WIN.w, 2, PALETTE.frame); px(WIN.x, WIN.y + WIN.h - 2, WIN.w, 2, PALETTE.frame);
      px(WIN.x, WIN.y, 2, WIN.h, PALETTE.frame); px(WIN.x + WIN.w - 2, WIN.y, 2, WIN.h, PALETTE.frame);
      px(WIN.x + WIN.w / 2 - 1, WIN.y, 2, WIN.h, PALETTE.frameDark); px(WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 2, PALETTE.frameDark);
      // glass shine
      px(GLASS.x + 2, GLASS.y + 2, 1, 4, 'rgba(255,255,255,0.55)'); px(GLASS.x + 4, GLASS.y + 2, 1, 2, 'rgba(255,255,255,0.4)');
      // sill
      px(WIN.x - 3, WIN.y + WIN.h, WIN.w + 6, 3, PALETTE.sill); px(WIN.x - 3, WIN.y + WIN.h + 2, WIN.w + 6, 1, PALETTE.frameDark);

      // curtains — drawn aside when closed, billowing when the window is open
      const sway = a.open ? Math.sin(t * 2.2) * 2 + 2 : 0;
      const cw = a.open ? 7 : 5;
      for (let y = WIN.y; y < WIN.y + WIN.h; y++) {
        const wave = Math.round(Math.sin(y / 3 + t * (a.open ? 3 : 0.8)) * (a.open ? 1.5 : 0.5));
        px(WIN.x - 1, y, cw + Math.round(sway) + wave, 1, y % 4 < 2 ? PALETTE.curtain : PALETTE.curtainDark);
        px(WIN.x + WIN.w - cw + 1 - Math.round(sway) - wave, y, cw + Math.round(sway) + wave, 1, y % 4 < 2 ? PALETTE.curtain : PALETTE.curtainDark);
      }
      px(WIN.x - 2, WIN.y - 2, WIN.w + 4, 2, PALETTE.frameDark); // rod

      // plant on the sill (right)
      px(WIN.x + 25, WIN.y + WIN.h - 5, 6, 5, PALETTE.pot); px(WIN.x + 24, WIN.y + WIN.h - 6, 8, 1, PALETTE.pot);
      const lean = Math.round(Math.sin(t * (a.open ? 3 : 1)) * (a.open ? 1.5 : 0.6));
      px(WIN.x + 27 + lean, WIN.y + WIN.h - 12, 2, 6, PALETTE.leaf); px(WIN.x + 25 + lean, WIN.y + WIN.h - 10, 2, 3, PALETTE.leafDark);
      px(WIN.x + 29 + lean, WIN.y + WIN.h - 10, 2, 3, PALETTE.leafDark); px(WIN.x + 26 + lean, WIN.y + WIN.h - 13, 1, 2, PALETTE.leaf); px(WIN.x + 30 + lean, WIN.y + WIN.h - 13, 1, 2, PALETTE.leaf);

      // cat sitting on the sill
      const hopT = a.hop > 0 ? a.hop-- : 0;
      const hopY = hopT ? -Math.round(Math.sin((1 - hopT / 18) * Math.PI) * 7) : 0;
      const cx = 13, cy = WIN.y + WIN.h + hopY; // cy = bottom of the cat
      const blink = f % 150 > 144;
      // tail
      const tail = Math.round(Math.sin(t * 3) * 2);
      px(cx + 9, cy - 3, 3, 2, PALETTE.cat); px(cx + 11 + (tail > 0 ? 0 : -1), cy - 6 + (tail > 0 ? 0 : 1), 2, 4, PALETTE.cat); px(cx + 12 + tail, cy - 7, 2, 2, PALETTE.catDark);
      // body
      px(cx, cy - 6, 10, 6, PALETTE.cat); px(cx + 1, cy - 1, 8, 1, PALETTE.catDark); px(cx + 3, cy - 4, 4, 4, PALETTE.catLight);
      px(cx + 2, cy - 5, 1, 2, PALETTE.catDark); px(cx + 7, cy - 5, 1, 2, PALETTE.catDark);
      // head
      px(cx + 1, cy - 12, 8, 7, PALETTE.cat); px(cx + 1, cy - 14, 2, 2, PALETTE.cat); px(cx + 7, cy - 14, 2, 2, PALETTE.cat);
      px(cx + 2, cy - 13, 1, 1, PALETTE.pink); px(cx + 7, cy - 13, 1, 1, PALETTE.pink);
      px(cx + 3, cy - 11, 1, 2, PALETTE.catDark); px(cx + 5, cy - 11, 1, 2, PALETTE.catDark); // forehead stripes
      // eyes follow the pointer
      const look = a.mouseX < 0.35 ? -1 : a.mouseX > 0.65 ? 1 : 0;
      if (blink || hopT) { px(cx + 2, cy - 9, 2, 1, PALETTE.ink); px(cx + 6, cy - 9, 2, 1, PALETTE.ink); }
      else { px(cx + 2 + (look > 0 ? 1 : 0), cy - 9, 1, 2, PALETTE.ink); px(cx + 7 + (look < 0 ? -1 : 0), cy - 9, 1, 2, PALETTE.ink); }
      px(cx + 4, cy - 7, 2, 1, PALETTE.pink); px(cx + 4, cy - 6, 1, 1, PALETTE.ink); px(cx + 5, cy - 6, 1, 1, PALETTE.ink);
      px(cx - 1, cy - 8, 2, 1, PALETTE.catLight); px(cx + 9, cy - 8, 2, 1, PALETTE.catLight); // whiskers
      // paws
      px(cx + 1, cy - 1, 3, 1, PALETTE.catLight); px(cx + 6, cy - 1, 3, 1, PALETTE.catLight);

      // hearts from petting
      a.hearts = a.hearts.filter((h) => h.t < 40);
      a.hearts.forEach((h) => {
        h.t++;
        const hx = h.x + Math.round(Math.sin(h.t / 4) * 2), hy = h.y - Math.floor(h.t / 2.5);
        if (hy < 0) return;
        px(hx, hy, 1, 1, '#F25C7A'); px(hx + 2, hy, 1, 1, '#F25C7A'); px(hx, hy + 1, 3, 1, '#F25C7A'); px(hx + 1, hy + 2, 1, 1, '#F25C7A');
      });
    };

    let raf = 0;
    let last = 0;
    const interval = reduced ? 250 : 1000 / 30;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < interval) return;
      last = now;
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Interaction ─────────────────────────────────────────────────────
  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const a = anim.current;
    const onCat = x >= 11 && x <= 27 && y >= WIN.y + WIN.h - 16 && y <= WIN.y + WIN.h + 2;
    if (onCat) {
      a.hop = 18;
      a.hearts.push({ x: 15 + Math.floor(Math.random() * 6), y: WIN.y + WIN.h - 16, t: 0 }, { x: 19 + Math.floor(Math.random() * 6), y: WIN.y + WIN.h - 14, t: 6 });
      setQuote((i) => (i + 1) % QUOTES.length);
    } else if (x >= WIN.x - 2 && x <= WIN.x + WIN.w + 2 && y >= WIN.y - 2 && y <= WIN.y + WIN.h + 3) {
      a.open = !a.open; // open / close the window — curtains and plant react
    }
  }, []);
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    anim.current.mouseX = (e.clientX - r.left) / r.width;
  };

  return (
    <div
      className="rounded-xl border border-[#E6DFD3] bg-[#F5F1E8] p-3 self-stretch flex items-center gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <canvas
        ref={canvasRef} width={W} height={H} onClick={onClick} onMouseMove={onMove}
        aria-label={`Pixel window showing ${LABEL[weather.sky].toLowerCase()} weather in ${CITY}. Click the cat or the window.`}
        className="shrink-0 cursor-pointer rounded-lg border-2 border-[#8B5E3C] shadow-sm"
        style={{ width: 176, height: 132, imageRendering: 'pixelated' }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7F6E]">{CITY}</span>
          <span className="text-xs font-bold text-[#3D3929]">
            {loaded ? <>{weather.temp != null ? `${weather.temp}°C` : ''} <span className="font-medium text-[#8A7F6E]">{LABEL[weather.sky]}{weather.isDay ? '' : ' · night'}</span></> : <span className="text-[#8A7F6E]">Looking outside…</span>}
          </span>
        </div>
        {/* speech bubble from the cat */}
        <div className="relative rounded-lg bg-white/80 px-2.5 py-1.5 border border-[#E6DFD3]">
          <span className="absolute -left-1.5 top-3 h-2.5 w-2.5 rotate-45 border-b border-l border-[#E6DFD3] bg-white/80" aria-hidden="true" />
          <p className="text-[13px] leading-snug text-[#3D3929]" style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }} aria-live="polite">{QUOTES[quote]}</p>
        </div>
        <p className="text-[9px] text-[#A89C87]">Pet the cat for a new note · click the window to open it</p>
      </div>
    </div>
  );
}
