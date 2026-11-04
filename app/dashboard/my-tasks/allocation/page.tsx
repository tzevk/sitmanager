'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Settings { enabled: boolean; startAfterId: number; firstResponseMinutes: number; updatedAt: string | null }
interface BatchRef { batchId: number; batchCode: string; courseName: string | null; startDate: string | null }
interface Counsellor {
  userId: number; name: string; active: boolean; acceptsLeads: boolean; inFallbackPool: boolean;
  onLeaveNow: boolean; leadsToday: number; openLeads: number; batches: BatchRef[];
}
interface BatchOption { Batch_Id: number; Batch_code: string; Course_Name: string | null; SDate: string | null }
interface LogRow { id: number; Inquiry_Id: number; Student_Name: string | null; rule: string; detail: string | null; created_at: string; owner: string | null }

const RULE_STYLE: Record<string, string> = {
  returning: 'bg-violet-100 text-violet-700', batch: 'bg-emerald-100 text-emerald-700', course: 'bg-sky-100 text-sky-700',
  fallback: 'bg-amber-100 text-amber-800', creator: 'bg-slate-100 text-slate-700', manual: 'bg-indigo-100 text-indigo-700',
};
const ctrl = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30';

export default function LeadAllocationPage() {
  const { canView, loading: permLoading } = useResourcePermissions('inquiry');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Counsellor | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch('/api/inquiry/lead-allocation', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load');
      setSettings(d.settings); setCounsellors(d.counsellors); setBatches(d.batches); setLog(d.log);
      setCanManage(Boolean(d.canManage)); setPending(d.unassignedSinceStart);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }, []);
  useEffect(() => { if (canView) load(); }, [canView, load]);

  const putSettings = async (body: Record<string, unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/inquiry/lead-allocation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      if (d.result) setNotice(d.result.ran ? `Assigned ${d.result.assigned} lead(s)${d.result.unassignable ? `, ${d.result.unassignable} had no eligible counsellor` : ''}.` : 'Nothing to do (allocation is off or already running).');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setBusy(false);
  };

  const uncovered = useMemo(() => {
    const active = counsellors.filter(c => c.active && c.acceptsLeads);
    return { none: active.length === 0, noFallback: !active.some(c => c.inFallbackPool), noBatches: active.every(c => c.batches.length === 0) };
  }, [counsellors]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view lead allocation." />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-slate-900">Lead Allocation</h1>
          <p className="text-xs text-slate-500">New inquiries are given an owner automatically, using the batches linked to each counsellor.</p>
        </div>
        <Link href="/dashboard/my-tasks" className={`${ctrl} inline-flex items-center font-semibold`}>← My Tasks</Link>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{notice}</p>}

      {/* Settings */}
      {settings && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Auto-assign</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${settings.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{settings.enabled ? 'On' : 'Off'}</span>
              {canManage && (
                <button disabled={busy} onClick={() => putSettings({ enabled: !settings.enabled })} className={`${ctrl} font-semibold`}>
                  {settings.enabled ? 'Turn off' : 'Turn on'}
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {settings.enabled ? `Covers inquiries after #${settings.startAfterId}. Older leads stay as they are.` : 'When turned on, only leads arriving from that moment are assigned.'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">First call within</p>
            <div className="mt-1 flex items-center gap-2">
              <select disabled={!canManage || busy} value={settings.firstResponseMinutes} onChange={e => putSettings({ firstResponseMinutes: Number(e.target.value) })} className={ctrl}>
                {[15, 30, 60, 120, 240].map(m => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>)}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">After this the owner gets a reminder and managers get an alert.</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Waiting for an owner</p>
            <p className="mt-1 text-xl font-black text-slate-800">{pending ?? '—'}</p>
            {canManage && settings.enabled && <button disabled={busy} onClick={() => putSettings({ runNow: true })} className={`${ctrl} font-semibold`}>Run now</button>}
          </div>
        </div>
      )}

      {(uncovered.none || uncovered.noFallback) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {uncovered.none ? 'No counsellor is taking leads, so every new lead will stay unassigned.' : 'No counsellor is in the fallback pool: leads that match no batch will stay unassigned (managers are alerted).'}
        </p>
      )}

      {/* How it works */}
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-800">How a lead is assigned</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li><b>Entered by a counsellor:</b> it stays with them.</li>
          <li><b>Returning person:</b> same owner as their earlier inquiry.</li>
          <li><b>Batch:</b> the inquiry&apos;s batch is linked to counsellors. The one with the fewest leads today gets it.</li>
          <li><b>Course:</b> no batch, but the course has a live batch linked to counsellors. Same tie-break.</li>
          <li><b>Fallback pool:</b> everyone in the pool, by fewest leads today.</li>
        </ol>
        <p className="mt-2">Counsellors who are inactive, on leave (Scheduling Settings → leave) or not taking leads are skipped. Ties go to whoever was assigned least recently. A lead already assigned by hand is never changed. A lead no one can take stays unassigned, and managers are alerted.</p>
      </details>

      {/* Counsellors */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Counsellor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Batches</th>
              <th className="px-3 py-2 text-right">Today</th><th className="px-3 py-2 text-right">Last 60 days</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {counsellors.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No counsellors yet. Add them in Scheduling Settings.</td></tr>}
            {counsellors.map(c => (
              <tr key={c.userId} className="border-b border-slate-100 align-top">
                <td className="px-3 py-2 font-semibold text-slate-800">{c.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {!c.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Inactive</span>}
                    {c.onLeaveNow && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">On leave</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.acceptsLeads ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{c.acceptsLeads ? 'Taking leads' : 'Paused'}</span>
                    {c.inFallbackPool && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">Fallback</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {c.batches.length === 0 ? <span className="text-slate-400">—</span> : (
                    <div className="flex max-w-md flex-wrap gap-1">
                      {c.batches.map(b => <span key={b.batchId} title={b.courseName ?? ''} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{b.batchCode}</span>)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-bold">{c.leadsToday}</td>
                <td className="px-3 py-2 text-right">{c.openLeads}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && <button onClick={() => setEditing(c)} className={`${ctrl} font-semibold`}>Edit</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent allocations */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Recent allocations</p>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {log.length === 0 && <tr><td className="px-4 py-6 text-center text-slate-400">No allocations yet.</td></tr>}
              {log.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="whitespace-nowrap px-4 py-1.5 text-slate-400">{l.created_at}</td>
                  <td className="px-2 py-1.5"><Link href={`/dashboard/inquiry/add?editId=${l.Inquiry_Id}`} className="font-semibold text-[#2E3093] hover:underline">{l.Student_Name || `#${l.Inquiry_Id}`}</Link></td>
                  <td className="px-2 py-1.5">→ {l.owner ?? '—'}</td>
                  <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${RULE_STYLE[l.rule] ?? 'bg-slate-100'}`}>{l.rule}</span></td>
                  <td className="px-2 py-1.5 text-slate-500">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditCounsellorModal
          counsellor={editing}
          batches={batches}
          onClose={() => setEditing(null)}
          onSaved={(list) => { setCounsellors(list); setEditing(null); setNotice('Saved.'); }}
        />
      )}
    </div>
  );
}

function EditCounsellorModal({ counsellor, batches, onClose, onSaved }: {
  counsellor: Counsellor; batches: BatchOption[]; onClose: () => void; onSaved: (list: Counsellor[]) => void;
}) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(counsellor.batches.map(b => b.batchId)));
  const [accepts, setAccepts] = useState(counsellor.acceptsLeads);
  const [fallback, setFallback] = useState(counsellor.inFallbackPool);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return batches.filter(b => !n || `${b.Batch_code} ${b.Course_Name ?? ''}`.toLowerCase().includes(n));
  }, [batches, q]);

  const toggle = (id: number) => setPicked(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/inquiry/lead-allocation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: counsellor.userId, batchIds: [...picked], acceptsLeads: accepts, inFallbackPool: fallback }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      onSaved(d.counsellors);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-black text-slate-900">{counsellor.name}</p>
          <p className="text-[11px] text-slate-500">Pick the batches whose leads this counsellor should receive.</p>
        </div>
        <div className="space-y-2 px-5 py-3">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={accepts} onChange={e => setAccepts(e.target.checked)} /> Taking new leads</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fallback} onChange={e => setFallback(e.target.checked)} /> In the fallback pool (gets leads that match no batch)</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search batch or course…" className={`${ctrl} w-full`} />
          <p className="text-[11px] text-slate-500">{picked.size} batch(es) selected</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-100 px-5 py-2">
          {visible.map(b => (
            <label key={b.Batch_Id} className="flex cursor-pointer items-center gap-2 py-1 text-xs hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(b.Batch_Id)} onChange={() => toggle(b.Batch_Id)} />
              <span className="font-semibold text-slate-800">{b.Batch_code}</span>
              <span className="truncate text-slate-500">{b.Course_Name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">{b.SDate}</span>
            </label>
          ))}
          {visible.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No batches match.</p>}
        </div>
        {err && <p className="px-5 pt-2 text-xs font-semibold text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 px-5 py-3">
          <button onClick={onClose} disabled={saving} className={`${ctrl} font-semibold`}>Cancel</button>
          <button onClick={save} disabled={saving} className="h-8 rounded-lg bg-[#2E3093] px-4 text-xs font-bold text-white hover:bg-[#252780] disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
