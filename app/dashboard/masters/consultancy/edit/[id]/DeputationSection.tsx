'use client';

import { useCallback, useEffect, useState } from 'react';

const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const textareaCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

const AGREEMENT_STATUSES = [
  'Not Started',
  'Draft Shared',
  'Under Review',
  'Negotiating',
  'Approved',
  'Active',
  'On Hold',
  'Declined',
] as const;

interface ConsultancyOption {
  Const_Id: number;
  Comp_Name: string;
}

interface DeputationPosition {
  ID: number;
  Deputation_Id: number;
  Position_Title: string | null;
  Total_Requirement: number | null;
  Short_Description: string | null;
  Working_Location: string | null;
  Status: string;
  Interview_Arrangement: string | null;
  Went_Ahead: boolean;
  Joining_Date: string | null;
  Closed_By: string | null;
  Closing_Notes: string | null;
}

interface DeputationNegotiation {
  ID: number;
  Deputation_Id: number;
  Negotiation_Date: string | null;
  Discussion: string;
  Created_At: string | null;
}

interface DeputationEntry {
  Deputation_Id: number;
  Const_Id: number;
  Company_Name: string;
  Is_Other: boolean;
  Agreement_Status: string | null;
  JD_Shared: boolean;
  JD_Shared_Date: string | null;
  Created_By: string;
  negotiations: DeputationNegotiation[];
  positions: DeputationPosition[];
}

const today = () => new Date().toISOString().slice(0, 10);

const toDateInput = (v: string | null | undefined) => {
  if (!v) return '';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

const statusBadge = (status: string) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border';
  switch (status) {
    case 'Converted':
      return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    case 'Closed':
      return `${base} bg-gray-100 text-gray-700 border-gray-200`;
    default:
      return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  }
};

export default function DeputationSection({ constId }: { constId: number }) {
  const [consultancies, setConsultancies] = useState<ConsultancyOption[]>([]);
  const [entries, setEntries] = useState<DeputationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [entryForm, setEntryForm] = useState({
    Company_Name: '',
    Is_Other: false,
    Other_Company_Name: '',
    Agreement_Status: '',
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/masters/consultancy?limit=100')
      .then(r => r.json())
      .then(d => setConsultancies((d.rows ?? []).map((r: { Const_Id: number; Comp_Name: string }) => ({ Const_Id: r.Const_Id, Comp_Name: r.Comp_Name }))))
      .catch(() => { /* ignore */ });
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!constId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/masters/consultancy/deputation?constId=${constId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load deputation entries');
      setEntries(data.rows ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deputation entries');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [constId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const resolveCompanyName = () => {
    if (entryForm.Is_Other) return entryForm.Other_Company_Name.trim();
    return entryForm.Company_Name.trim();
  };

  const handleCreateEntry = async () => {
    const name = resolveCompanyName();
    if (!name) { setError('Please select or enter a company name'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/masters/consultancy/deputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          constId,
          Company_Name: name,
          Is_Other: entryForm.Is_Other,
          Agreement_Status: entryForm.Agreement_Status || null,
          JD_Shared: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setEntryForm({ Company_Name: '', Is_Other: false, Other_Company_Name: '', Agreement_Status: '' });
      fetchEntries();
      if (data.insertId) setExpandedId(Number(data.insertId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async (entry: DeputationEntry, patch: Partial<DeputationEntry>) => {
    setError(''); setSaving(true);
    try {
      const merged = { ...entry, ...patch };
      const res = await fetch('/api/masters/consultancy/deputation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: merged.Deputation_Id,
          Company_Name: merged.Company_Name,
          Is_Other: merged.Is_Other,
          Agreement_Status: merged.Agreement_Status,
          JD_Shared: merged.JD_Shared,
          JD_Shared_Date: merged.JD_Shared_Date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      fetchEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Delete this deputation entry? Positions and negotiations will also be removed.')) return;
    await fetch(`/api/masters/consultancy/deputation?id=${id}`, { method: 'DELETE' });
    fetchEntries();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* ----- New Entry Form ----- */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-md bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5">ATS</span>
          <h3 className="text-[13px] font-bold text-[#2E3093]">New Deputation Entry</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
          <div>
            <label className={labelCls}>Company</label>
            <select
              className={selectCls}
              value={entryForm.Is_Other ? '__other__' : entryForm.Company_Name}
              onChange={e => {
                const v = e.target.value;
                if (v === '__other__') {
                  setEntryForm(f => ({ ...f, Is_Other: true, Company_Name: '' }));
                } else {
                  setEntryForm(f => ({ ...f, Is_Other: false, Company_Name: v, Other_Company_Name: '' }));
                }
              }}
            >
              <option value="">--Select Company--</option>
              {consultancies.map(c => (
                <option key={c.Const_Id} value={c.Comp_Name}>{c.Comp_Name}</option>
              ))}
              <option value="__other__">Other (type manually)</option>
            </select>
          </div>
          {entryForm.Is_Other && (
            <div>
              <label className={labelCls}>Other Company Name</label>
              <input
                className={inputCls}
                value={entryForm.Other_Company_Name}
                onChange={e => setEntryForm(f => ({ ...f, Other_Company_Name: e.target.value }))}
                placeholder="Type company name"
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Agreement Status</label>
            <select
              className={selectCls}
              value={entryForm.Agreement_Status}
              onChange={e => setEntryForm(f => ({ ...f, Agreement_Status: e.target.value }))}
            >
              <option value="">--Select Status--</option>
              {AGREEMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleCreateEntry}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-60"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            )}
            Add Entry
          </button>
        </div>
      </div>

      {/* ----- Existing Entries ----- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-[#2E3093]">Deputation Entries ({entries.length})</h3>
          {loading && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        {!loading && entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-xs text-gray-500">
            No deputation entries yet. Add one above to begin tracking agreements and positions.
          </div>
        )}
        {entries.map(entry => (
          <EntryCard
            key={entry.Deputation_Id}
            entry={entry}
            expanded={expandedId === entry.Deputation_Id}
            onToggleExpand={() => setExpandedId(prev => prev === entry.Deputation_Id ? null : entry.Deputation_Id)}
            onUpdate={(patch) => handleUpdateEntry(entry, patch)}
            onDelete={() => handleDeleteEntry(entry.Deputation_Id)}
            onRefresh={fetchEntries}
          />
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onRefresh,
}: {
  entry: DeputationEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<DeputationEntry>) => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [negForm, setNegForm] = useState({ Negotiation_Date: today(), Discussion: '' });
  const [posForm, setPosForm] = useState({
    Position_Title: '',
    Total_Requirement: '',
    Short_Description: '',
    Working_Location: '',
  });
  const [editAgreement, setEditAgreement] = useState(false);
  const [busy, setBusy] = useState(false);

  const addNegotiation = async () => {
    if (!negForm.Discussion.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deputationId: entry.Deputation_Id,
          Negotiation_Date: negForm.Negotiation_Date || null,
          Discussion: negForm.Discussion.trim(),
        }),
      });
      setNegForm({ Negotiation_Date: today(), Discussion: '' });
      onRefresh();
    } finally { setBusy(false); }
  };

  const deleteNegotiation = async (id: number) => {
    if (!confirm('Delete this negotiation pointer?')) return;
    await fetch(`/api/masters/consultancy/deputation/negotiations?id=${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const addPosition = async () => {
    if (!posForm.Position_Title.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deputationId: entry.Deputation_Id,
          Position_Title: posForm.Position_Title.trim(),
          Total_Requirement: posForm.Total_Requirement || null,
          Short_Description: posForm.Short_Description.trim() || null,
          Working_Location: posForm.Working_Location.trim() || null,
        }),
      });
      setPosForm({ Position_Title: '', Total_Requirement: '', Short_Description: '', Working_Location: '' });
      onRefresh();
    } finally { setBusy(false); }
  };

  const toggleJdShared = () => {
    const next = !entry.JD_Shared;
    onUpdate({
      JD_Shared: next,
      JD_Shared_Date: next ? (entry.JD_Shared_Date || today()) : null,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
        <button onClick={onToggleExpand} className="flex items-center gap-2 text-left flex-1 min-w-0">
          <svg className={`w-4 h-4 text-[#2E3093] transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#2E3093] truncate">
              {entry.Company_Name}
              {entry.Is_Other && <span className="ml-2 text-[10px] font-semibold text-gray-500">(Other)</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {entry.Agreement_Status && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {entry.Agreement_Status}
                </span>
              )}
              {entry.JD_Shared && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  JD Shared {entry.JD_Shared_Date ? `· ${toDateInput(entry.JD_Shared_Date)}` : ''}
                </span>
              )}
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                {entry.positions.length} position{entry.positions.length === 1 ? '' : 's'}
              </span>
              <span className="text-[10px] text-gray-500">Created by {entry.Created_By}</span>
            </div>
          </div>
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-red-500 hover:bg-red-50 rounded"
          title="Delete entry"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-4">
          {/* Agreement status quick edit */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-600">Agreement Status:</span>
            {editAgreement ? (
              <>
                <select
                  className={`${selectCls} max-w-xs`}
                  value={entry.Agreement_Status || ''}
                  onChange={e => onUpdate({ Agreement_Status: e.target.value || null })}
                >
                  <option value="">--Select Status--</option>
                  {AGREEMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setEditAgreement(false)} className="text-[11px] text-gray-500 hover:text-gray-700">Done</button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-900">{entry.Agreement_Status || '—'}</span>
                <button onClick={() => setEditAgreement(true)} className="text-[11px] text-[#2E3093] hover:underline">Change</button>
              </>
            )}
          </div>

          {/* ----- Negotiation Pointers ----- */}
          <div className="rounded-md border border-gray-200">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
              <h4 className="text-xs font-bold text-[#2E3093]">Negotiation Pointers</h4>
            </div>
            <div className="p-3 space-y-2">
              {entry.negotiations.length === 0 && (
                <div className="text-[11px] text-gray-500 italic">No negotiation pointers logged yet.</div>
              )}
              {entry.negotiations.map(n => (
                <div key={n.ID} className="flex gap-2 items-start bg-gray-50 rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                      {n.Negotiation_Date ? new Date(n.Negotiation_Date).toLocaleDateString('en-GB') : 'No date'}
                    </div>
                    <div className="text-xs text-gray-900 whitespace-pre-wrap break-words">{n.Discussion}</div>
                  </div>
                  <button onClick={() => deleteNegotiation(n.ID)} className="p-1 text-red-500 hover:bg-red-100 rounded" title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={negForm.Negotiation_Date}
                    onChange={e => setNegForm(f => ({ ...f, Negotiation_Date: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Discussion</label>
                  <textarea
                    className={textareaCls}
                    rows={2}
                    value={negForm.Discussion}
                    onChange={e => setNegForm(f => ({ ...f, Discussion: e.target.value }))}
                    placeholder="Key points discussed"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addNegotiation}
                    disabled={busy || !negForm.Discussion.trim()}
                    className="w-full px-3 py-1.5 bg-[#2E3093] text-white text-xs font-semibold rounded-md hover:bg-[#2A6BB5] disabled:opacity-50"
                  >
                    Add Pointer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ----- JD Shared + Positions ----- */}
          <div className="rounded-md border border-gray-200">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#2E3093]">JD / Positions</h4>
              <button
                onClick={toggleJdShared}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                  entry.JD_Shared
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {entry.JD_Shared ? '✓ JD Shared' : 'Mark JD Shared'}
              </button>
            </div>

            {entry.JD_Shared ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-gray-600">Shared on:</label>
                  <input
                    type="date"
                    className={`${inputCls} max-w-[160px]`}
                    value={toDateInput(entry.JD_Shared_Date)}
                    onChange={e => onUpdate({ JD_Shared_Date: e.target.value || null })}
                  />
                </div>

                {entry.positions.length === 0 && (
                  <div className="text-[11px] text-gray-500 italic">No positions added yet.</div>
                )}

                {entry.positions.map(p => (
                  <PositionRow key={p.ID} position={p} onRefresh={onRefresh} />
                ))}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                  <div>
                    <label className={labelCls}>Position Title</label>
                    <input
                      className={inputCls}
                      value={posForm.Position_Title}
                      onChange={e => setPosForm(f => ({ ...f, Position_Title: e.target.value }))}
                      placeholder="e.g. Senior Analyst"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Total Requirement</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={posForm.Total_Requirement}
                      onChange={e => setPosForm(f => ({ ...f, Total_Requirement: e.target.value }))}
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Working Location</label>
                    <input
                      className={inputCls}
                      value={posForm.Working_Location}
                      onChange={e => setPosForm(f => ({ ...f, Working_Location: e.target.value }))}
                      placeholder="e.g. Mumbai (Hybrid)"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addPosition}
                      disabled={busy || !posForm.Position_Title.trim()}
                      className="w-full px-3 py-1.5 bg-[#2E3093] text-white text-xs font-semibold rounded-md hover:bg-[#2A6BB5] disabled:opacity-50"
                    >
                      Add Position
                    </button>
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelCls}>Short Description</label>
                    <textarea
                      className={textareaCls}
                      rows={2}
                      value={posForm.Short_Description}
                      onChange={e => setPosForm(f => ({ ...f, Short_Description: e.target.value }))}
                      placeholder="Role summary, key responsibilities…"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 text-[11px] text-gray-500 italic">
                Positions unlock after JD is shared. Click &quot;Mark JD Shared&quot; above to start adding positions.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position, onRefresh }: { position: DeputationPosition; onRefresh: () => void }) {
  const [closing, setClosing] = useState(false);
  const [closingForm, setClosingForm] = useState({
    Status: position.Status || 'Open',
    Interview_Arrangement: position.Interview_Arrangement || '',
    Went_Ahead: position.Went_Ahead,
    Joining_Date: toDateInput(position.Joining_Date),
    Closed_By: position.Closed_By || 'SIT AUTHORITY',
    Closing_Notes: position.Closing_Notes || '',
  });
  const [busy, setBusy] = useState(false);

  const convert = async () => {
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: position.ID,
          Position_Title: position.Position_Title,
          Total_Requirement: position.Total_Requirement,
          Short_Description: position.Short_Description,
          Working_Location: position.Working_Location,
          Status: 'Converted',
          Interview_Arrangement: position.Interview_Arrangement,
          Went_Ahead: position.Went_Ahead,
          Joining_Date: position.Joining_Date,
          Closed_By: position.Closed_By,
          Closing_Notes: position.Closing_Notes,
        }),
      });
      setClosing(true);
      onRefresh();
    } finally { setBusy(false); }
  };

  const saveClosing = async () => {
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: position.ID,
          Position_Title: position.Position_Title,
          Total_Requirement: position.Total_Requirement,
          Short_Description: position.Short_Description,
          Working_Location: position.Working_Location,
          Status: closingForm.Status || 'Converted',
          Interview_Arrangement: closingForm.Interview_Arrangement || null,
          Went_Ahead: closingForm.Went_Ahead,
          Joining_Date: closingForm.Went_Ahead ? closingForm.Joining_Date || null : null,
          Closed_By: closingForm.Closed_By || null,
          Closing_Notes: closingForm.Closing_Notes || null,
        }),
      });
      setClosing(false);
      onRefresh();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Delete this position?')) return;
    await fetch(`/api/masters/consultancy/deputation/positions?id=${position.ID}`, { method: 'DELETE' });
    onRefresh();
  };

  const showClosingSection = closing || position.Status === 'Converted' || position.Status === 'Closed';

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="px-3 py-2 border-b border-gray-100 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{position.Position_Title || 'Untitled'}</span>
            <span className={statusBadge(position.Status || 'Open')}>{position.Status || 'Open'}</span>
            {position.Total_Requirement != null && (
              <span className="text-[10px] text-gray-600">Req: {position.Total_Requirement}</span>
            )}
            {position.Working_Location && (
              <span className="text-[10px] text-gray-600">• {position.Working_Location}</span>
            )}
          </div>
          {position.Short_Description && (
            <div className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{position.Short_Description}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {position.Status === 'Open' && (
            <button
              onClick={convert}
              disabled={busy}
              className="px-2 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Convert
            </button>
          )}
          {(position.Status === 'Converted' || position.Status === 'Closed') && !closing && (
            <button
              onClick={() => setClosing(true)}
              className="px-2 py-1 text-[11px] font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Edit Closing
            </button>
          )}
          <button
            onClick={remove}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
            title="Delete position"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {showClosingSection && (
        <div className="p-3 bg-gray-50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#2E3093] text-white text-[10px] font-bold px-2 py-0.5">CLOSING TAG</span>
            <span className="text-[11px] text-gray-600">Interview arrangement &amp; outcome</span>
          </div>

          {closing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={selectCls}
                  value={closingForm.Status}
                  onChange={e => setClosingForm(f => ({ ...f, Status: e.target.value }))}
                >
                  <option value="Open">Open</option>
                  <option value="Converted">Converted</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Closed By</label>
                <input
                  className={inputCls}
                  value={closingForm.Closed_By}
                  onChange={e => setClosingForm(f => ({ ...f, Closed_By: e.target.value }))}
                  placeholder="SIT AUTHORITY"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Interview Arrangement Details</label>
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={closingForm.Interview_Arrangement}
                  onChange={e => setClosingForm(f => ({ ...f, Interview_Arrangement: e.target.value }))}
                  placeholder="Interview mode, rounds, logistics, outcome…"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`ga-${position.ID}`}
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#2E3093]"
                  checked={closingForm.Went_Ahead}
                  onChange={e => setClosingForm(f => ({ ...f, Went_Ahead: e.target.checked }))}
                />
                <label htmlFor={`ga-${position.ID}`} className="text-[11px] font-semibold text-gray-700">Candidate went ahead / joined</label>
              </div>
              {closingForm.Went_Ahead && (
                <div>
                  <label className={labelCls}>Joining Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={closingForm.Joining_Date}
                    onChange={e => setClosingForm(f => ({ ...f, Joining_Date: e.target.value }))}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <label className={labelCls}>Closing Notes</label>
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={closingForm.Closing_Notes}
                  onChange={e => setClosingForm(f => ({ ...f, Closing_Notes: e.target.value }))}
                  placeholder="Any final notes"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => setClosing(false)}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveClosing}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#2E3093] text-white hover:bg-[#2A6BB5] disabled:opacity-50"
                >
                  Save Closing Details
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div><span className="font-semibold text-gray-600">Closed By:</span> {position.Closed_By || '—'}</div>
              <div>
                <span className="font-semibold text-gray-600">Went Ahead:</span>{' '}
                {position.Went_Ahead ? 'Yes' : 'No'}
                {position.Went_Ahead && position.Joining_Date && (
                  <> · Joining {toDateInput(position.Joining_Date)}</>
                )}
              </div>
              <div className="md:col-span-2">
                <span className="font-semibold text-gray-600">Interview:</span>{' '}
                {position.Interview_Arrangement || '—'}
              </div>
              {position.Closing_Notes && (
                <div className="md:col-span-2">
                  <span className="font-semibold text-gray-600">Notes:</span> {position.Closing_Notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
