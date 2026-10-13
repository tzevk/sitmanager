'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AppointmentDetailModal, ModeBadge, STATUSES, StatusBadge, btnGhost, fmt12, fmtDate, inputCls, programOf,
  type Appointment,
} from './_components/shared';

interface Option { id: number; name: string }

function convertHref(a: Appointment): string {
  const notes = [
    `Appointment ${a.appointment_code} on ${fmtDate(a.appt_date)} ${fmt12(a.start_time)}`,
    programOf(a) ? `Program: ${programOf(a)}` : '',
    a.qualification ? `Qualification: ${a.qualification}` : '',
    a.experience ? `Experience: ${a.experience}` : '',
    a.notes ? `Notes: ${a.notes}` : '',
  ].filter(Boolean).join('\n');
  const p = new URLSearchParams();
  const name = `${a.first_name || ''} ${a.last_name || ''}`.trim();
  if (name) p.set('prefillName', name);
  if (a.mobile) p.set('prefillMobile', a.mobile);
  if (a.email) p.set('prefillEmail', a.email);
  p.set('prefillNotes', notes);
  return `/dashboard/inquiry/add?${p}`;
}

function AppointmentsManager() {
  const params = useSearchParams();
  const [rows, setRows] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [openId, setOpenId] = useState<number | null>(Number(params.get('open')) || null);
  const openParam = Number(params.get('open')) || null;
  useEffect(() => { if (openParam) setOpenId(openParam); }, [openParam]);

  const [filters, setFilters] = useState({ search: '', status: '', mode: '', course: '', counsellor: '', from: '', to: '' });
  const [programs, setPrograms] = useState<Option[]>([]);
  const [counsellors, setCounsellors] = useState<{ user_id: number; name: string }[]>([]);
  const limit = 25;

  useEffect(() => {
    fetch('/api/public/appointments/config').then((r) => r.json()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
    try {
      const r = await fetch(`/api/appointments?${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || d.message || 'Unable to load appointments');
      setRows(d.rows); setTotal(d.total); setCanManage(Boolean(d.canManage));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load appointments');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { const t = setTimeout(load, filters.search ? 300 : 0); return () => clearTimeout(t); }, [load, filters.search]);

  // Counsellor filter options (admins only) — reuse the calendar endpoint's counsellor list.
  useEffect(() => {
    if (!canManage) return;
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/appointments/calendar?from=${today}&to=${today}`).then((r) => r.json()).then((d) => setCounsellors(d.counsellors || [])).catch(() => {});
  }, [canManage]);

  const setF = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">{canManage ? 'All counselling appointments' : 'Your counselling appointments'}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/appointments/calendar" className={btnGhost}>Calendar</Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <input className={`${inputCls} col-span-2`} placeholder="Search ID, name, mobile, email…" value={filters.search} onChange={setF('search')} />
          <select className={inputCls} value={filters.status} onChange={setF('status')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className={inputCls} value={filters.mode} onChange={setF('mode')}>
            <option value="">All modes</option><option value="online">Online</option><option value="offline">Offline</option>
          </select>
          <select className={inputCls} value={filters.course} onChange={setF('course')}>
            <option value="">All programs</option>
            <option value="guidance">Need guidance</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" className={inputCls} value={filters.from} onChange={setF('from')} title="From date" />
          <input type="date" className={inputCls} value={filters.to} onChange={setF('to')} title="To date" />
          {canManage && (
            <select className={inputCls} value={filters.counsellor} onChange={setF('counsellor')}>
              <option value="">All counsellors</option>
              {counsellors.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-sm [&_td]:border-l [&_td]:border-gray-200 [&_td:first-child]:border-l-0 [&_th]:border-l [&_th]:border-gray-200 [&_th:first-child]:border-l-0">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-[110px] px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Applicant</th>
              <th className="hidden w-[150px] px-3 py-2.5 xl:table-cell">Background</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Program</th>
              <th className="hidden w-[90px] px-3 py-2.5 lg:table-cell">Mode</th>
              <th className="hidden w-[130px] px-3 py-2.5 lg:table-cell">Counsellor</th>
              <th className="w-[110px] px-3 py-2.5">Status</th>
              <th className="w-[120px] px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">No appointments found</td></tr>
            ) : rows.map((a) => (
              <tr key={a.id} className="align-top hover:bg-gray-50/70 cursor-pointer" onClick={() => setOpenId(a.id)}>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-gray-800">{fmtDate(a.appt_date)}</div>
                  <div className="text-xs text-gray-500">{fmt12(a.start_time)}</div>
                </td>
                <td className="px-3 py-2.5 min-w-0">
                  <div className="truncate font-semibold text-gray-900">{a.first_name} {a.last_name}</div>
                  <div className="truncate text-xs text-gray-600">{a.mobile}</div>
                  <div className="truncate text-xs text-gray-400" title={a.email}>{a.email}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-[#2E3093]">{a.appointment_code}</div>
                </td>
                <td className="hidden px-3 py-2.5 text-xs text-gray-600 xl:table-cell">
                  <div className="truncate" title={a.qualification || ''}>{a.qualification || '—'}</div>
                  <div className="truncate text-gray-400" title={a.experience || ''}>{a.experience || '—'}</div>
                </td>
                <td className="hidden px-3 py-2.5 text-gray-700 md:table-cell">
                  <div className="line-clamp-2 break-words" title={programOf(a)}>{programOf(a)}</div>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell"><ModeBadge mode={a.mode} /></td>
                <td className="hidden px-3 py-2.5 text-gray-700 lg:table-cell"><div className="truncate">{a.counsellor_name || '—'}</div></td>
                <td className="px-3 py-2.5"><StatusBadge appt={a} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col items-end gap-1.5">
                    <button className="text-xs font-semibold text-[#2E3093] hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}>View</button>
                    <Link
                      href={convertHref(a)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Convert
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{total} appointment{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} / {pages}</span>
          <button className={btnGhost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {openId && <AppointmentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
      <AppointmentsManager />
    </Suspense>
  );
}
