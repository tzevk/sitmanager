'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useEscape } from './ToastProvider';

/* Style tokens used across every finance tab. */
export const thCls  = 'px-3 py-2.5 text-left text-[10px] font-semibold text-white uppercase tracking-wide whitespace-nowrap border border-white/20';
export const tdCls  = 'px-3 py-2.5 text-xs text-gray-700 border border-gray-200 bg-white';
export const tdNum  = 'px-3 py-2.5 text-xs text-center text-gray-700 border border-gray-200 bg-white';
export const inpCls = 'w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors';
export const lblCls = 'block text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wide';

/** Returns className for a table data row — pass the row index for alternating stripes + hover. */
export function trCls(i: number): string {
  return `group transition-colors bg-white hover:bg-indigo-50/20`;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-[#2E3093] flex items-center gap-2 mb-0">
      <span className="inline-block w-1 h-4 rounded-full bg-[#2E3093] flex-shrink-0" />
      {children}
    </h2>
  );
}

export function EmptyRow({ cols, message = 'No records yet — click "+ Add" to get started' }: { cols: number; message?: string }) {
  return (
    <tr>
      <td colSpan={cols}>
        <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
          <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs italic">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export function TableSkeleton({ rows = 4, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={r % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-2.5">
              <div className="h-3 rounded-full bg-gray-200/80 animate-pulse" style={{ width: `${55 + (c * 11 % 35)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableHeader({ title, onAdd, addLabel = 'Add', extra }: { title: string; onAdd?: () => void; addLabel?: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex items-center gap-2 flex-wrap">
        {extra}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] active:scale-95 transition-all shadow-sm shadow-[#2E3093]/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <td className="px-2 py-1.5 text-center whitespace-nowrap">
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors mr-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </td>
  );
}

/** Inline percentage with a mini colour-coded progress bar. */
export function PctBar({ value, denominator }: { value: number | string; denominator: number | string }) {
  const a = Number(value), b = Number(denominator);
  const pctValue = Number.isFinite(a) && b > 0 ? Math.min(100, (a / b) * 100) : null;
  const label = pctValue == null ? '—' : `${pctValue.toFixed(1)}%`;
  const barColor = pctValue == null ? '' : pctValue >= 80 ? 'bg-emerald-500' : pctValue >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = pctValue == null ? 'text-gray-400' : pctValue >= 80 ? 'text-emerald-700' : pctValue >= 50 ? 'text-amber-700' : 'text-red-600';
  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px] px-1">
      <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
      {pctValue != null && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pctValue}%` }} />
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
  saveLabel?: string;
}

export function Modal({ open, title, saving, onClose, onSave, children, saveLabel = 'Save' }: ModalProps) {
  useEscape(onClose, open);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus first input on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>('input,select,textarea,button');
      first?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#2E3093] to-[#3d40a8] text-white">
          <h3 className="text-sm font-bold tracking-wide">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 pb-4 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880] transition-colors disabled:opacity-60 shadow-sm shadow-[#2E3093]/20">
            {saving && (
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  const topBorder = accent?.includes('red') ? 'border-t-red-500'
    : accent?.includes('emerald') ? 'border-t-emerald-500'
    : accent?.includes('amber') ? 'border-t-amber-500'
    : 'border-t-[#2E3093]';
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 border-t-[3px] ${topBorder} hover:shadow-md transition-shadow`}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-lg font-bold mt-1.5 leading-none ${accent ?? 'text-[#2E3093]'}`}>{value}</p>
    </div>
  );
}

export function TotalRow({ children }: { children: ReactNode }) {
  return (
    <tr className="bg-[#2E3093]/5 border-t-2 border-[#2E3093]/20 font-semibold">
      {children}
    </tr>
  );
}

/** Download an array of objects as a CSV. Keys are inferred from the first row. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
