'use client';

import { useRef, type ReactNode, type PointerEvent } from 'react';

/**
 * Textured, pointer-reactive backdrop for the brand panel of the sign-in pages:
 * grain + fine lines, drifting glows with light parallax, and a spotlight that
 * follows the pointer. Styles live in globals.css (.auth-*).
 */
export function AuthBackdrop({ className = '', children }: { className?: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--px', String((x - 0.5) * -24));
    el.style.setProperty('--py', String((y - 0.5) * -24));
  }

  return (
    <div ref={ref} onPointerMove={onPointerMove} className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 auth-parallax pointer-events-none">
        <div className="absolute -top-16 -left-10 w-80 h-80 rounded-full bg-[#FAE452]/20 blur-3xl auth-drift" />
        <div className="absolute -bottom-24 -right-16 w-[28rem] h-[28rem] rounded-full bg-[#2A6BB5]/40 blur-3xl auth-drift-slow" />
        <div className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-white/10 blur-2xl auth-drift" />
      </div>
      <div className="absolute inset-0 auth-lines pointer-events-none" />
      <div className="absolute inset-0 auth-grain opacity-[0.18] pointer-events-none" />
      <div className="absolute inset-0 auth-spotlight pointer-events-none" />
      {children}
    </div>
  );
}

/** Tracks the pointer on a form card so its glowing edge (.auth-card) follows it. */
export function trackCardGlow(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--cx', `${e.clientX - r.left}px`);
  el.style.setProperty('--cy', `${e.clientY - r.top}px`);
}
