'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toBatchNumber } from '@/lib/batch-display';

/**
 * CBD dashboard: batch-wise alumni registration from the LAST uploaded
 * alumni-portal report (Alumni Association page) — no re-upload needed.
 * Latest batch (by end date) first; Excel download for the table and, for
 * users with Alumni view access, each batch's student list.
 */

interface BatchRow {
  batchId: number;
  batchCode: string;
  batchName: string;
  startDate: string | null;
  endDate: string | null;
  totalStudents: number;
  registered: number;
  left: number;
  percentage: number;
}

interface LastUpload {
  fileName: string | null;
  totalRows: number;
  uploadedAt: string;
  uploadedByName: string | null;
  savedAt: string | null;
}

const TABLE_CLS = 'w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0';

const ddmmyyyy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
function fmtStamp(v: string | null) {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function batchStatus(b: BatchRow, today: string): { label: string; cls: string } {
  if (b.startDate && b.startDate > today) return { label: 'Upcoming', cls: 'border-sky-100 bg-sky-50 text-sky-700' };
  if (b.endDate && b.endDate < today) return { label: 'Completed', cls: 'border-gray-200 bg-gray-50 text-gray-600' };
  return { label: 'Ongoing', cls: 'border-emerald-100 bg-emerald-50 text-emerald-700' };
}
const barTone = (p: number) => (p >= 75 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400');

async function downloadXlsx(fileName: string, sheetName: string, title: string, headers: string[], rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIT Manager';
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
  ws.getRow(1).height = 24;
  const header = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E9F5' } };
  });
  rows.forEach((r) => ws.addRow(r));
  headers.forEach((h, i) => {
    const longest = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(45, Math.max(10, longest + 2));
  });
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

const GradIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
);
const DownloadIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
);

export default function AlumniRegistrationWidget() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null);
  const [canDownloadStudents, setCanDownloadStudents] = useState(false);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [completedOnly, setCompletedOnly] = useState(false);
  const [endFrom, setEndFrom] = useState('');
  const [endTo, setEndTo] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [today, setToday] = useState('');

  const load = useCallback(() => {
    fetch('/api/admission-activity/alumni/batch-summary', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed');
        setBatches(d.batches ?? []);
        setLastUpload(d.lastUpload ?? null);
        setCanDownloadStudents(Boolean(d.canDownloadStudents));
        setToday(todayIso());
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => batches.filter((b) => {
    if (completedOnly && !(b.endDate && today && b.endDate < today)) return false;
    if (endFrom && (!b.endDate || b.endDate < endFrom)) return false;
    if (endTo && (!b.endDate || b.endDate > endTo)) return false;
    return true;
  }), [batches, completedOnly, endFrom, endTo, today]);

  const totals = useMemo(() => {
    const total = rows.reduce((n, b) => n + b.totalStudents, 0);
    const registered = rows.reduce((n, b) => n + b.registered, 0);
    return { total, registered, left: total - registered, pct: total ? Math.round((registered / total) * 1000) / 10 : 0 };
  }, [rows]);

  const filtersActive = completedOnly || !!endFrom || !!endTo;
  const uploadedLabel = lastUpload ? ddmmyyyy(lastUpload.uploadedAt.slice(0, 10)) : '';

  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const downloadAll = async () => {
    setBusy('all'); setDownloadError('');
    try {
      await downloadXlsx(
        `Alumni_Batchwise_${todayIso()}.xlsx`, 'Batch-wise',
        `Alumni Registration — Batch-wise (report uploaded ${uploadedLabel})`,
        ['Sr No', 'Batch Name', 'Batch No', 'Start Date', 'End Date', 'Total Students', 'Students Registered', 'Students Left', 'Percentage'],
        rows.map((b, i) => [i + 1, b.batchName, toBatchNumber(b.batchCode), ddmmyyyy(b.startDate), ddmmyyyy(b.endDate), b.totalStudents, b.registered, b.left, `${b.percentage}%`])
      );
    } catch { setDownloadError('Download failed — please try again.'); } finally { setBusy(null); }
  };

  const downloadBatch = async (b: BatchRow) => {
    setBusy(b.batchId); setDownloadError('');
    try {
      const r = await fetch(`/api/admission-activity/alumni/batch-summary?batchId=${b.batchId}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      const students: Array<{ rollNo: string; name: string; mobile: string; email: string; registered: boolean }> = d.students ?? [];
      await downloadXlsx(
        `Alumni_Batch_${b.batchCode}.xlsx`, `Batch ${b.batchCode}`.slice(0, 31),
        `Batch ${toBatchNumber(b.batchCode)} · ${b.batchName} · ${b.registered}/${b.totalStudents} registered (${b.percentage}%) · report uploaded ${uploadedLabel}`,
        ['Roll No.', 'Student Name', 'Mobile', 'Email', 'Alumni Registered'],
        students.map((s) => [s.rollNo, s.name, s.mobile, s.email, s.registered ? 'Yes' : 'No'])
      );
    } catch { setDownloadError(`Download for batch ${b.batchCode} failed — please try again.`); } finally { setBusy(null); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-white">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 text-[#2E3093] [&_svg]:w-4 [&_svg]:h-4">{GradIcon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-800 text-sm tracking-tight">Alumni Registration</p>
          <p className="text-[11px] text-gray-500">
            {lastUpload
              ? <>From the last uploaded report{lastUpload.fileName ? ` (${lastUpload.fileName})` : ''} · uploaded on <span className="font-semibold text-[#2E3093]">{fmtStamp(lastUpload.uploadedAt)}</span>{lastUpload.uploadedByName ? ` by ${lastUpload.uploadedByName}` : ''}</>
              : 'Batch-wise registration on the Sitians Alumni portal'}
          </p>
        </div>
        {state === 'ready' && lastUpload && (
          <div className="flex items-center gap-2 text-right">
            <div className="rounded-lg bg-white border border-gray-100 px-3 py-1 shadow-sm" title="Registered users in the uploaded report (Staff Membership excluded)">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">In Report</p>
              <p className="text-sm font-black tabular-nums text-gray-800">{lastUpload.totalRows.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-lg bg-white border border-indigo-100 px-3 py-1 shadow-sm" title="Report users matched to a student with a batch admission / total students in the batches shown">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Registered in Batches</p>
              <p className="text-sm font-black tabular-nums text-[#2E3093]">{totals.registered.toLocaleString('en-IN')} <span className="text-gray-400 font-bold">/ {totals.total.toLocaleString('en-IN')}</span></p>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 px-3 py-1 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Overall</p>
              <p className="text-sm font-black tabular-nums text-gray-800">{totals.pct}%</p>
            </div>
          </div>
        )}
      </div>

      {state === 'ready' && lastUpload && batches.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 cursor-pointer">
            <input type="checkbox" checked={completedOnly} onChange={(e) => setCompletedOnly(e.target.checked)} className="w-3.5 h-3.5 accent-[#2E3093]" />
            Completed batches only
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">End date</span>
            <input type="date" value={endFrom} onChange={(e) => setEndFrom(e.target.value)} aria-label="End date from"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:outline-none focus:border-[#2E3093]" />
            <span className="text-[11px] text-gray-400">to</span>
            <input type="date" value={endTo} onChange={(e) => setEndTo(e.target.value)} aria-label="End date to"
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:outline-none focus:border-[#2E3093]" />
          </div>
          {filtersActive && (
            <button type="button" onClick={() => { setCompletedOnly(false); setEndFrom(''); setEndTo(''); }}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 underline">Clear filters</button>
          )}
          <span className="ml-auto text-[11px] text-gray-400">{rows.length} batch{rows.length === 1 ? '' : 'es'}</span>
          <button type="button" onClick={downloadAll} disabled={busy !== null || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-[#2E3093] hover:bg-[#25267d] transition-colors disabled:opacity-50">
            <DownloadIcon className="w-3.5 h-3.5" />
            {busy === 'all' ? 'Preparing…' : 'Download'}
          </button>
        </div>
      )}
      {downloadError && <p className="px-4 py-2 text-[11px] font-semibold text-red-600 border-b border-gray-100">{downloadError}</p>}

      {state === 'loading' ? (
        <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}</div>
      ) : state === 'error' ? (
        <p className="px-5 py-6 text-center text-sm text-red-600">
          Couldn&apos;t load alumni registration. <button onClick={() => { setState('loading'); load(); }} className="underline">Retry</button>
        </p>
      ) : !lastUpload ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">No alumni report uploaded yet — upload one on the Alumni Association page.</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">No batches match the selected filters</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="max-h-72 overflow-y-auto">
            <table className={TABLE_CLS}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-100">
                  {['Sr No', 'Batch Name', 'Batch No', 'Start Date', 'End Date', 'Total Students', 'Registered', 'Left', 'Percentage', 'Report'].map((h) => (
                    <th key={h} className={`py-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${h === 'Batch Name' ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => {
                  const open = expanded.has(b.batchId);
                  const st = batchStatus(b, today);
                  return (
                    <React.Fragment key={b.batchId}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-center text-xs font-bold tabular-nums text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700 min-w-[180px]">
                          <button type="button" onClick={() => toggle(b.batchId)} title={open ? 'Collapse details' : 'Expand for details'}
                            className="inline-flex items-center gap-1.5 flex-wrap text-left hover:text-[#2E3093] transition-colors">
                            <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            {b.batchName || '—'}
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${st.cls}`}>{st.label}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center text-xs font-mono text-gray-500 whitespace-nowrap">{toBatchNumber(b.batchCode)}</td>
                        <td className="px-3 py-2 text-center text-[11px] tabular-nums text-gray-500 whitespace-nowrap">{ddmmyyyy(b.startDate)}</td>
                        <td className="px-3 py-2 text-center text-[11px] tabular-nums text-gray-500 whitespace-nowrap">{ddmmyyyy(b.endDate)}</td>
                        <td className="px-3 py-2 text-center text-xs font-bold tabular-nums text-gray-700">{b.totalStudents}</td>
                        <td className="px-3 py-2 text-center text-xs font-bold tabular-nums text-emerald-700">{b.registered}</td>
                        <td className="px-3 py-2 text-center text-xs font-bold tabular-nums text-red-600">{b.left}</td>
                        <td className="px-3 py-2 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${barTone(b.percentage)}`} style={{ width: `${Math.min(100, b.percentage)}%` }} /></div>
                            <span className="w-11 text-right text-xs font-black tabular-nums text-gray-700">{b.percentage}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {canDownloadStudents ? (
                            <button type="button" onClick={() => downloadBatch(b)} disabled={busy !== null}
                              title={`Download batch ${b.batchCode} student list (Excel)`} aria-label={`Download batch ${b.batchCode} student list`}
                              className="inline-flex items-center justify-center p-1.5 rounded-md text-[#2E3093] hover:bg-[#2E3093]/10 transition-colors disabled:opacity-40">
                              {busy === b.batchId ? <span className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" /> : <DownloadIcon />}
                            </button>
                          ) : (
                            <span className="inline-flex p-1.5 text-gray-300" title="Student lists need Alumni view access"><DownloadIcon /></span>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-gray-100 bg-gray-50/40">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-4 text-[11px]">
                              <div><span className="font-bold uppercase tracking-wide text-gray-400">Students</span><span className="ml-1.5 font-black tabular-nums text-gray-700">{b.totalStudents}</span></div>
                              <div><span className="font-bold uppercase tracking-wide text-gray-400">Registered</span><span className="ml-1.5 font-black tabular-nums text-emerald-700">{b.registered}</span></div>
                              <div><span className="font-bold uppercase tracking-wide text-gray-400">Left</span><span className="ml-1.5 font-black tabular-nums text-red-600">{b.left}</span></div>
                              <div><span className="font-bold uppercase tracking-wide text-gray-400">Percentage</span><span className="ml-1.5 font-black tabular-nums text-[#2E3093]">{b.percentage}%</span></div>
                              {canDownloadStudents && (
                                <button type="button" onClick={() => downloadBatch(b)} disabled={busy !== null}
                                  className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-[#2E3093] hover:bg-[#25267d] transition-colors disabled:opacity-50">
                                  <DownloadIcon className="w-3.5 h-3.5" /> Download Student List (Excel)
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-indigo-50/60">
                  <td className="px-3 py-2.5 text-right text-xs font-black uppercase tracking-wide text-gray-700" colSpan={5}>Total &gt;&gt;&gt;</td>
                  <td className="px-3 py-2.5 text-center text-sm font-black tabular-nums text-gray-800">{totals.total}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-black tabular-nums text-emerald-700">{totals.registered}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-black tabular-nums text-red-600">{totals.left}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-black tabular-nums text-[#2E3093]" colSpan={2}>{totals.pct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
