'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const FLUSH_MS = 15000;
const HEARTBEAT_MS = 60000;
const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="menuitem"], summary';

type TrackedEvent = { type: 'PAGE' | 'CLICK'; page: string; label?: string };

/** Sends page visits, button/link labels and presence. Never reads form fields. */
export default function ActivityTracker() {
  const pathname = usePathname();
  const queue = useRef<TrackedEvent[]>([]);
  const lastSent = useRef(0);
  const page = useRef(pathname);

  useEffect(() => {
    page.current = pathname;
    queue.current.push({ type: 'PAGE', page: pathname });
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null;
      if (!target) return;
      const label = (target.getAttribute('aria-label') || target.title || target.innerText || '').trim().slice(0, 80);
      queue.current.push({ type: 'CLICK', page: page.current, label: label || 'Unnamed button' });
    };
    const flush = () => {
      const heartbeatDue = !document.hidden && Date.now() - lastSent.current >= HEARTBEAT_MS;
      if (!queue.current.length && !heartbeatDue) return;
      const events = queue.current.splice(0);
      lastSent.current = Date.now();
      fetch('/api/activity-log/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page.current, events }),
        keepalive: true,
      }).catch(() => {});
    };
    document.addEventListener('click', onClick, true);
    const timer = setInterval(flush, FLUSH_MS);
    return () => { document.removeEventListener('click', onClick, true); clearInterval(timer); };
  }, []);

  return null;
}
