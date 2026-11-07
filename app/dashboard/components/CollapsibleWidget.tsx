'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** A compact show/hide bar around a dashboard widget. The choice is remembered per browser. */
export default function CollapsibleWidget({ id, title, children, defaultOpen = true }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const storageKey = `dash-collapse:${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved choice after mount
      if (v === '0' || v === '1') setOpen(v === '1');
    } catch { /* storage unavailable — keep the default */ }
  }, [storageKey]);

  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(storageKey, o ? '0' : '1'); } catch { /* ignore */ }
      return !o;
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`collapse-${id}`}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left shadow-sm hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-bold text-[#2E3093]">{title}</span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          {open ? 'Hide' : 'Show'}
          <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && <div id={`collapse-${id}`} className="mt-2">{children}</div>}
    </div>
  );
}
