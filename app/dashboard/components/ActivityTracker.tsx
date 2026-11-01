'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const FLUSH_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = FLUSH_MS - 10_000;
const CHUNK = 300;
const MAX_QUEUE = 1000;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_API = ['/api/auth/', '/api/activity-log'];
const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="menuitem"], summary';

type TrackedEvent = {
  type: 'PAGE' | 'CLICK' | 'REQUEST';
  page: string;
  at: number;
  label?: string;
  method?: string;
  status?: number;
  count?: number;
};

/**
 * Collects page visits, button/link labels and write requests, and sends them
 * together every 10 minutes (or when the tab is hidden) so monitoring costs the
 * database very little. Never reads form fields or request bodies.
 */
export default function ActivityTracker() {
  const pathname = usePathname();
  const queue = useRef<TrackedEvent[]>([]);
  const lastSent = useRef(0);
  const page = useRef(pathname);

  useEffect(() => {
    page.current = pathname;
    if (queue.current.length < MAX_QUEUE) queue.current.push({ type: 'PAGE', page: pathname, at: Date.now() });
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null;
      if (!target || queue.current.length >= MAX_QUEUE) return;
      const label = (target.getAttribute('aria-label') || target.title || target.innerText || '').trim().slice(0, 80);
      queue.current.push({ type: 'CLICK', page: page.current, at: Date.now(), label: label || 'Unnamed button' });
    };

    const recordRequest = (method: string, path: string, status: number) => {
      // Repeats collapse into one row with a count, however many a screen sends.
      const same = queue.current.find((e) => e.type === 'REQUEST' && e.page === path && e.method === method && e.status === status);
      if (same) same.count = (same.count ?? 1) + 1;
      else if (queue.current.length < MAX_QUEUE) queue.current.push({ type: 'REQUEST', page: path, at: Date.now(), method, status, count: 1 });
    };

    const originalFetch = window.fetch;
    const trackedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      try {
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const raw = input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.origin);
        if (WRITE_METHODS.has(method) && url.origin === window.location.origin && url.pathname.startsWith('/api/')
          && !SKIP_API.some((p) => url.pathname.startsWith(p))) {
          recordRequest(method, url.pathname, response.status);
        }
      } catch {
        // Tracking must never affect the request itself.
      }
      return response;
    };
    window.fetch = trackedFetch;

    const flush = (leaving = false) => {
      const heartbeatDue = !document.hidden && Date.now() - lastSent.current >= HEARTBEAT_MS;
      if (!queue.current.length && !heartbeatDue) return;
      lastSent.current = Date.now();
      const send = (events: TrackedEvent[]) => originalFetch('/api/activity-log/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page.current, events }),
        keepalive: leaving,
      });
      (async () => {
        do {
          await send(queue.current.splice(0, CHUNK));
        } while (queue.current.length);
      })().catch(() => {});
    };

    const onHidden = () => { if (document.hidden && queue.current.length) flush(true); };
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('click', onClick, true);
    const timer = setInterval(() => flush(), FLUSH_MS);
    return () => {
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('click', onClick, true);
      clearInterval(timer);
    };
  }, []);

  return null;
}
