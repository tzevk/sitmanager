'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';
interface Toast { id: number; kind: ToastKind; message: string }

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string | unknown) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++;
    setToasts(t => [...t, { id, kind, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (e) => show(e instanceof Error ? e.message : String(e ?? 'Error'), 'error'),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg shadow-lg border px-4 py-2.5 text-xs font-medium max-w-sm ${
              t.kind === 'error'   ? 'bg-red-50 border-red-200 text-red-700'
            : t.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            :                        'bg-white border-gray-200 text-gray-700'
            }`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Fallback so individual tabs that mount in tests/storybook still work.
    return {
      show: (m) => console.log('[toast]', m),
      success: (m) => console.log('[toast.success]', m),
      error: (e) => console.error('[toast.error]', e),
    };
  }
  return ctx;
}

/** Hook into Esc key, e.g. for closing modals. */
export function useEscape(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') handler(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [handler, enabled]);
}
