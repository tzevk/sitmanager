'use client';

import { useEffect, useMemo, useState } from 'react';

type Faculty = { Faculty_Id: number; Faculty_Name: string };

/**
 * Batch Master → "Trainers": the trainers linked to this batch. Each one sees
 * the batch, with its full lecture plan, in the Trainer Portal. Saves on its
 * own, separately from the batch form.
 */
export default function BatchTrainersCard({ batchId, canUpdate }: { batchId: string; canUpdate: boolean }) {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/masters/batch/${batchId}/trainers`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setFaculty(Array.isArray(d?.facultyList) ? d.facultyList : []);
        const ids = Array.isArray(d?.trainerIds) ? d.trainerIds.map(Number) : [];
        setSaved(ids);
        setSelected(ids);
      })
      .catch(() => { if (active) setMessage({ ok: false, text: 'Could not load trainers.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batchId]);

  const nameOf = useMemo(() => new Map(faculty.map((f) => [Number(f.Faculty_Id), f.Faculty_Name])), [faculty]);
  const dirty = selected.length !== saved.length || selected.some((id) => !saved.includes(id));
  const options = faculty.filter((f) =>
    !selected.includes(Number(f.Faculty_Id)) && f.Faculty_Name?.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/trainers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyIds: selected }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || 'Failed to save trainers');
      const ids = Array.isArray(d?.trainerIds) ? d.trainerIds.map(Number) : selected;
      setSaved(ids);
      setSelected(ids);
      setMessage({ ok: true, text: 'Trainers saved.' });
    } catch (err: unknown) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to save trainers' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-800">Trainers</h3>
          <p className="text-[10px] text-slate-500">Linked trainers see this batch and its lecture plan in the Trainer Portal.</p>
        </div>
        {canUpdate && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || loading}
            className="px-3 py-1 rounded-md bg-[#2E3093] text-white text-[11px] font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Trainers'}
          </button>
        )}
      </div>
      <div className="p-3 space-y-2">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {selected.length === 0 && (
                <span className="text-xs text-slate-400">No trainers linked yet.</span>
              )}
              {selected.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#2E3093]/10 px-2.5 py-1 text-xs font-semibold text-[#2E3093]">
                  {nameOf.get(id) || `Faculty #${id}`}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => prev.filter((x) => x !== id))}
                      className="ml-0.5 text-[#2E3093]/60 hover:text-red-600"
                      aria-label="Remove trainer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canUpdate && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trainer…"
                  className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs focus:outline-none focus:border-[#2E3093]"
                />
                <select
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) setSelected((prev) => [...prev, id]);
                    setSearch('');
                  }}
                  className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:border-[#2E3093]"
                >
                  <option value="">Add trainer ({options.length})</option>
                  {options.map((f) => (
                    <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>
                  ))}
                </select>
              </div>
            )}
            {message && (
              <p className={`text-xs font-medium ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
