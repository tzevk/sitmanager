'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Batch-wise alumni registration from the LAST uploaded alumni-portal report
 * (no re-upload needed). Latest batch (by end date) first, with an Excel
 * download for the whole table and one per batch.
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
  id: number;
  fileName: string | null;
  totalRows: number;
  matchedCount: number;
  uploadedAt: string;
  uploadedByName: string | null;
  savedAt: string | null;
}

interface BatchStudent {
  studentId: number;
  name: string;
  rollNo: string;
  mobile: string;
  email: string;
  registered: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}` : iso;
}
function fmtDateTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const pctTone = (p: number) => (p >= 75 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400');

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
    c.border = { bottom: { style: 'thin', color: { argb: 'FF2E3093' } } };
  });
  rows.forEach((r) => ws.addRow(r));
  headers.forEach((h, i) => {
    const longest = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(45, Math.max(10, longest + 2));
  });
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

export default function AlumniBatchWidget({ refreshKey }: { refreshKey: number }) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<number | 'all' | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admission-activity/alumni/batch-summary', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed');
        setBatches(d.batches ?? []);
        setLastUpload(d.lastUpload ?? null);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? batches.filter((b) => b.batchCode.toLowerCase().includes(q) || b.batchName.toLowerCase().includes(q)) : batches;
  }, [batches, search]);

  const totals = useMemo(() => {
    const total = shown.reduce((n, b) => n + b.totalStudents, 0);
    const registered = shown.reduce((n, b) => n + b.registered, 0);
    return { total, registered, left: total - registered, pct: total ? Math.round((registered / total) * 1000) / 10 : 0 };
  }, [shown]);

  const uploadedLabel = lastUpload ? `${fmtDate(lastUpload.uploadedAt)}` : '';

  const downloadAll = async () => {
    setDownloading('all');
    setDownloadError('');
    try {
      await downloadXlsx(
        `Alumni_Batchwise_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Batch-wise',
        `Alumni Registration — Batch-wise (report uploaded ${uploadedLabel})`,
        ['Batch No.', 'Batch Name', 'Start Date', 'End Date', 'Total Students', 'Students Registered', 'Students Left', 'Percentage'],
        shown.map((b) => [b.batchCode, b.batchName, fmtDate(b.startDate), fmtDate(b.endDate), b.totalStudents, b.registered, b.left, `${b.percentage}%`])
      );
    } catch {
      setDownloadError('Download failed — please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const downloadBatch = async (b: BatchRow) => {
    setDownloading(b.batchId);
    setDownloadError('');
    try {
      const r = await fetch(`/api/admission-activity/alumni/batch-summary?batchId=${b.batchId}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      const students: BatchStudent[] = d.students ?? [];
      await downloadXlsx(
        `Alumni_Batch_${b.batchCode}.xlsx`,
        `Batch ${b.batchCode}`.slice(0, 31),
        `Batch ${b.batchCode} · ${b.batchName} · ${b.registered}/${b.totalStudents} registered (${b.percentage}%) · report uploaded ${uploadedLabel}`,
        ['Roll No.', 'Student Name', 'Mobile', 'Email', 'Alumni Registered'],
        students.map((s) => [s.rollNo, s.name, s.mobile, s.email, s.registered ? 'Yes' : 'No'])
      );
    } catch {
      setDownloadError(`Download for batch ${b.batchCode} failed — please try again.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Batch-wise Alumni Registration</div>
          {lastUpload ? (
            <p className="mt-0.5 text-xs text-slate-600">
              From the last uploaded report{lastUpload.fileName ? <> <span className="font-semibold text-slate-800">{lastUpload.fileName}</span></> : ''} —
              uploaded on <span className="font-semibold text-[#2E3093]">{fmtDateTime(lastUpload.uploadedAt)}</span>
              {lastUpload.uploadedByName ? ` by ${lastUpload.uploadedByName}` : ''}
              {!lastUpload.savedAt && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">not saved yet</span>}
            </p>
          ) : state === 'ready' ? (
            <p className="mt-0.5 text-xs text-slate-500">No alumni report uploaded yet — upload one below and it will be used here from then on.</p>
          ) : null}
        </div>
        {lastUpload && batches.length > 0 && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch or course"
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs min-w-0 flex-1 sm:w-[180px] sm:flex-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
            <button onClick={downloadAll} disabled={downloading !== null}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              {downloading === 'all' ? 'Preparing…' : 'Download Report'}
            </button>
          </div>
        )}
      </div>

      {state === 'loading' && <div className="py-8 text-center text-xs text-slate-400">Loading batch-wise summary…</div>}
      {state === 'error' && (
        <div className="py-8 text-center text-xs text-red-600">
          Couldn&apos;t load the batch-wise summary. <button onClick={() => { setState('loading'); load(); }} className="underline">Retry</button>
        </div>
      )}

      {state === 'ready' && lastUpload && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
            {[
              { label: search ? 'Students (filtered)' : 'Total Students', value: totals.total.toLocaleString(), cls: 'text-slate-700' },
              { label: 'Registered', value: totals.registered.toLocaleString(), cls: 'text-emerald-600' },
              { label: 'Left', value: totals.left.toLocaleString(), cls: 'text-red-500' },
              { label: 'Overall', value: `${totals.pct}%`, cls: 'text-[#2E3093]' },
            ].map((t) => (
              <div key={t.label} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t.label}</div>
                <div className={`text-base font-black ${t.cls}`}>{t.value}</div>
              </div>
            ))}
          </div>
          {downloadError && <div className="px-4 py-2 text-xs font-semibold text-red-600">{downloadError}</div>}
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs border-collapse [&_td]:border-r [&_td]:border-slate-100 [&_td:last-child]:border-r-0">
              <thead className="sticky top-0 z-10">
                <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Batch No.</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Batch Name</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Start Date</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">End Date</th>
                  <th className="text-right py-2 px-3 font-bold whitespace-nowrap">Total Students</th>
                  <th className="text-right py-2 px-3 font-bold whitespace-nowrap">Registered</th>
                  <th className="text-right py-2 px-3 font-bold whitespace-nowrap">Left</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap min-w-[130px]">Percentage</th>
                  <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Report</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400">No batches match.</td></tr>
                ) : shown.map((b) => (
                  <tr key={b.batchId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">{b.batchCode}</td>
                    <td className="py-1.5 px-3 text-slate-700 max-w-[260px]"><span className="block truncate" title={b.batchName}>{b.batchName || '—'}</span></td>
                    <td className="py-1.5 px-3 whitespace-nowrap text-slate-600">{fmtDate(b.startDate)}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap text-slate-600">{fmtDate(b.endDate)}</td>
                    <td className="py-1.5 px-3 text-right font-semibold text-slate-700">{b.totalStudents}</td>
                    <td className="py-1.5 px-3 text-right font-semibold text-emerald-600">{b.registered}</td>
                    <td className="py-1.5 px-3 text-right font-semibold text-red-500">{b.left}</td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full ${pctTone(b.percentage)}`} style={{ width: `${Math.min(100, b.percentage)}%` }} />
                        </div>
                        <span className="w-11 text-right font-bold text-slate-700">{b.percentage}%</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button onClick={() => downloadBatch(b)} disabled={downloading !== null} title={`Download batch ${b.batchCode} student list`}
                        aria-label={`Download batch ${b.batchCode} student list`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2E3093]/25 text-[10px] font-bold text-[#2E3093] hover:bg-[#2E3093]/10 disabled:opacity-40">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                        {downloading === b.batchId ? '…' : 'Excel'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-400">
            {shown.length} batches · latest end date first · total = active admissions (cancelled excluded) · registered = matched in the last report or marked Alumni Registered
          </div>
        </>
      )}
    </div>
  );
}
