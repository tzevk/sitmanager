'use client';

import { useCallback, useEffect, useState } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

interface DetailRow {
  Student_Id: number;
  Student_Name: string;
  Present_Mobile: string | null;
  Email: string | null;
  Inquiry_Dt: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Qualification: string | null;
  source_course: string | null;
  source_location: string | null;
  source_page_source: string | null;
  source_table_name: string;
  source_inquiry_id: number;
  source_created_date: string | null;
  source_created_day: string | null;
  has_pune_location: number;
  has_pune_page_source: number;
  has_pune_listing_text: number;
}

interface GroupRow {
  inquiry_count: number;
  source_course?: string;
  source_created_day?: string;
  source_location?: string;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return String(d);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SuvidyaPuneReportPage() {
  return (
    <PermissionGate resource="report_suvidya_pune" deniedMessage="You do not have permission to view Pune inquiry reports.">
      {() => <SuvidyaPuneReportContent />}
    </PermissionGate>
  );
}

function SuvidyaPuneReportContent() {
  const [sourceMatch, setSourceMatch] = useState<'all' | 'location' | 'page_source'>('all');
  const [dateFrom, setDateFrom] = useState(monthAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [byCourse, setByCourse] = useState<GroupRow[]>([]);
  const [byDate, setByDate] = useState<GroupRow[]>([]);
  const [byLocation, setByLocation] = useState<GroupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ sourceMatch, dateFrom, dateTo });
      const res = await fetch(`/api/reports/suvidya-pune?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Failed to load report');
      setRows(data.rows || []);
      setByCourse(data.byCourse || []);
      setByDate(data.byDate || []);
      setByLocation(data.byLocation || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setRows([]);
      setByCourse([]);
      setByDate([]);
      setByLocation([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, sourceMatch]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const exportDetails = () => {
    downloadCsv(
      `suvidya-pune-${sourceMatch}-${dateFrom}-to-${dateTo}.csv`,
      ['Student Id', 'Name', 'Mobile', 'Email', 'Inquiry Date', 'Inquiry From', 'Inquiry Type', 'Qualification', 'Source Course', 'Source Location', 'Source Page Source', 'Source Date'],
      rows.map((row) => [
        String(row.Student_Id),
        row.Student_Name || '',
        row.Present_Mobile || '',
        row.Email || '',
        row.Inquiry_Dt || '',
        row.Inquiry_From || '',
        row.Inquiry_Type || '',
        row.Qualification || '',
        row.source_course || '',
        row.source_location || '',
        row.source_page_source || '',
        row.source_created_date || '',
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-700">Suvidya Pune Inquiries</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Pune Source Report</h1>
            <p className="mt-2 text-sm text-slate-600">Split imported Suvidya inquiries by Pune location, Pune page source, and date range from the DB view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={sourceMatch} onChange={(e) => setSourceMatch(e.target.value as 'all' | 'location' | 'page_source')} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="all">All Pune Signals</option>
              <option value="location">Only Pune Location</option>
              <option value="page_source">Only Pune Page Source</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700" />
            <button onClick={() => void loadReport()} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">Apply</button>
            <button onClick={exportDetails} disabled={!rows.length} className="rounded-xl border border-amber-400 bg-amber-200 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-50">Export CSV</button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Rows</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? '…' : total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Course</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{byCourse[0]?.source_course || '—'}</p>
          <p className="text-xs text-slate-500">{byCourse[0]?.inquiry_count || 0} inquiries</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Location</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{byLocation[0]?.source_location || '—'}</p>
          <p className="text-xs text-slate-500">{byLocation[0]?.inquiry_count || 0} inquiries</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Latest Source Day</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{byDate[0]?.source_created_day || '—'}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {[
          { title: 'By Course', rows: byCourse, keyName: 'source_course' },
          { title: 'By Date', rows: byDate, keyName: 'source_created_day' },
          { title: 'By Location', rows: byLocation, keyName: 'source_location' },
        ].map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{section.title}</div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {section.rows.map((row, index) => (
                    <tr key={`${section.title}-${index}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-600">{String(row[section.keyName as keyof GroupRow] || 'Unknown')}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">{row.inquiry_count}</td>
                    </tr>
                  ))}
                  {!section.rows.length && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-slate-400">No rows</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">Detailed Rows</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Mobile</th>
                <th className="px-3 py-2 text-left">Course</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Page Source</th>
                <th className="px-3 py-2 text-left">Signal</th>
                <th className="px-3 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No Pune inquiries found</td></tr>
              ) : rows.map((row) => {
                const signal = row.has_pune_location ? 'Pune Location' : row.has_pune_page_source ? 'Pune Page Source' : 'Listing Text';
                return (
                  <tr key={`${row.Student_Id}-${row.source_inquiry_id}`} className="border-b border-slate-100 last:border-0 hover:bg-amber-50/60">
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.Student_Name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.Present_Mobile || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.source_course || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.source_location || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[300px] truncate">{row.source_page_source || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">{signal}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(row.source_created_day || row.source_created_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}