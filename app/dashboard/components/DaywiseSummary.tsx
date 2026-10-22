'use client';

import { useEffect, useMemo, useState } from 'react';

interface Row { day: string; userId: number | null; counsellor: string; contacted: number; followedUp: number; admitted: number }
interface Counsellor { id: number | null; name: string }

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 3).join('.') || '—';
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

/**
 * Day-wise summary: for each day, what each counsellor did — contacted, followed up, admitted —
 * plus inquiries received. Used on the Inquiry Report page and the CBD dashboard.
 */
export default function DaywiseSummary({
  from, to, title = 'Day-wise summary', canDownload = true, maxHeight = 420,
}: { from: string; to: string; title?: string; canDownload?: boolean; maxHeight?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [newInquiries, setNewInquiries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!from || !to || from > to) return;
    let active = true;
    setLoading(true); setError('');
    fetch(`/api/inquiry/daywise-summary?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to load'); return d; })
      .then((d) => { if (!active) return; setRows(d.rows || []); setCounsellors(d.counsellors || []); setNewInquiries(d.newInquiries || {}); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const days = useMemo(() => [...new Set([...rows.map((r) => r.day), ...Object.keys(newInquiries)])].sort().reverse(), [rows, newInquiries]);
  const cell = (day: string, id: number | null) => rows.find((r) => r.day === day && r.userId === id);
  const totalsFor = (list: Row[]) => list.reduce((t, r) => ({ c: t.c + r.contacted, f: t.f + r.followedUp, a: t.a + r.admitted }), { c: 0, f: 0, a: 0 });
  const grand = totalsFor(rows);
  const newTotal = Object.values(newInquiries).reduce((a, b) => a + b, 0);

  const download = async () => {
    setDownloading(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');
      const wb = new ExcelJS.Workbook();
      const head = (ws: import('exceljs').Worksheet) => {
        const r = ws.getRow(1);
        r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
      };

      // Sheet 1 — one row per day per counsellor (filterable / pivotable).
      const long = wb.addWorksheet('Daywise by counsellor');
      long.columns = [
        { header: 'Date', key: 'day', width: 14 }, { header: 'Counsellor', key: 'who', width: 26 },
        { header: 'Contacted', key: 'c', width: 12 }, { header: 'Followed up', key: 'f', width: 13 }, { header: 'Admitted', key: 'a', width: 11 },
      ];
      [...rows].sort((a, b) => a.day.localeCompare(b.day) || a.counsellor.localeCompare(b.counsellor))
        .forEach((r) => long.addRow({ day: r.day, who: r.counsellor, c: r.contacted, f: r.followedUp, a: r.admitted }));
      head(long);
      long.addRow({ day: 'Total', c: grand.c, f: grand.f, a: grand.a }).font = { bold: true };

      // Sheet 2 — one row per day: inquiries received and each counsellor's totals.
      const names = counsellors.map((c) => c.name);
      const wide = wb.addWorksheet('Daywise summary');
      wide.columns = [
        { header: 'Date', key: 'day', width: 14 }, { header: 'New inquiries', key: 'n', width: 14 },
        { header: 'Contacted', key: 'c', width: 12 }, { header: 'Followed up', key: 'f', width: 13 }, { header: 'Admitted', key: 'a', width: 11 },
        ...names.map((n) => ({ header: `${n} (C / F / A)`, key: `u_${n}`, width: 22 })),
      ];
      [...days].sort().forEach((day) => {
        const t = totalsFor(rows.filter((r) => r.day === day));
        const row: Record<string, string | number> = { day, n: newInquiries[day] ?? 0, c: t.c, f: t.f, a: t.a };
        counsellors.forEach((c) => {
          const r = cell(day, c.id);
          row[`u_${c.name}`] = r ? `${r.contacted} / ${r.followedUp} / ${r.admitted}` : '—';
        });
        wide.addRow(row);
      });
      head(wide);
      wide.addRow({ day: 'Total', n: newTotal, c: grand.c, f: grand.f, a: grand.a }).font = { bold: true };

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Daywise_Summary_${from}_to_${to}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
    setDownloading(false);
  };

  const n = (v: number, cls: string) => <span className={v ? `font-bold ${cls}` : 'text-gray-300'}>{v}</span>;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          <p className="text-[11px] text-gray-400">{from} → {to} · each cell: Contacted / Followed up / Admitted</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden gap-3 text-[11px] font-semibold sm:flex">
            <span className="text-indigo-700">New {newTotal}</span>
            <span className="text-sky-700">Contacted {grand.c}</span>
            <span className="text-violet-700">Followed up {grand.f}</span>
            <span className="text-emerald-700">Admitted {grand.a}</span>
          </div>
          {canDownload && (
            <button type="button" onClick={download} disabled={downloading || loading || days.length === 0}
              className="rounded-lg bg-[#2E3093] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252780] disabled:opacity-50">
              {downloading ? 'Preparing…' : 'Download Excel'}
            </button>
          )}
        </div>
      </header>
      {error && <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-center">New inquiries</th>
              {counsellors.map((c) => <th key={String(c.id)} className="px-2 py-2 text-center" title={c.name}>{c.id == null ? 'Unassigned' : initials(c.name)}</th>)}
              <th className="px-2 py-2 text-center">Total C / F / A</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={counsellors.length + 3} className="py-8 text-center text-gray-400">Loading…</td></tr>}
            {!loading && days.length === 0 && <tr><td colSpan={counsellors.length + 3} className="py-8 text-center text-gray-400">No activity in this range.</td></tr>}
            {!loading && days.map((day) => {
              const t = totalsFor(rows.filter((r) => r.day === day));
              return (
                <tr key={day} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-gray-700">{fmtDay(day)}</td>
                  <td className="px-2 py-1.5 text-center">{n(newInquiries[day] ?? 0, 'text-indigo-700')}</td>
                  {counsellors.map((c) => {
                    const r = cell(day, c.id);
                    return (
                      <td key={String(c.id)} className="whitespace-nowrap px-2 py-1.5 text-center">
                        {r ? <>{n(r.contacted, 'text-sky-700')}<span className="text-gray-300"> / </span>{n(r.followedUp, 'text-violet-700')}<span className="text-gray-300"> / </span>{n(r.admitted, 'text-emerald-700')}</> : <span className="text-gray-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-gray-700">{t.c} / {t.f} / {t.a}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
