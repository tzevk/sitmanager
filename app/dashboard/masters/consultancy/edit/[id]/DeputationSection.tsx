'use client';

import { useCallback, useEffect, useState } from 'react';

/* ---- Design tokens ---- */
const blueLabel = 'block text-[11px] font-semibold text-slate-600 mb-0.5';
const blueInput =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 transition-all shadow-sm';
const blueSelect =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm';
const blueTextarea =
  'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 transition-all resize-none shadow-sm';
const blueBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-sm hover:shadow-md';
const blueBtnOutline =
  'inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 transition-all';
const dangerBtnOutline =
  'inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 hover:border-red-300 transition-all';

type Phase = 'proposal' | 'agreement' | 'negotiation' | 'signed' | 'closed' | 'declined';

const PHASE_ORDER: Phase[] = ['proposal', 'agreement', 'negotiation', 'signed', 'closed'];
const PHASE_LABELS: Record<Phase, string> = {
  proposal: 'Proposal',
  agreement: 'Agreement',
  negotiation: 'Negotiation',
  signed: 'Signed',
  closed: 'Closed',
  declined: 'Declined',
};
const PHASE_ICONS: Record<Phase, string> = {
  proposal: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 3h5.25a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  agreement: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  negotiation: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  signed: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
  closed: 'M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75',
  declined: 'M6 18L18 6M6 6l12 12',
};

interface Candidate {
  ID: number;
  Position_Id: number;
  Candidate_Name: string | null;
  Mobile: string | null;
  Email: string | null;
  Status: string;
  Offer_Letter_Shared: boolean;
  Offer_Letter_Date: string | null;
  Joining_Date: string | null;
  Notes: string | null;
}

interface Position {
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
  candidates: Candidate[];
}

interface Discussion {
  ID: number;
  Deputation_Id: number;
  Negotiation_Date: string | null;
  Discussion: string;
  Phase: 'deputation' | 'negotiation';
  Created_At: string | null;
}

type ServiceType = 'deputation' | 'permanent' | 'contract';

const SERVICE_LABELS: Record<ServiceType, string> = {
  deputation: 'Deputation',
  permanent: 'Permanent Hiring',
  contract: 'Contractual Staffing',
};

const SERVICE_ICONS: Record<ServiceType, string> = {
  deputation: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  permanent: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
  contract: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
};

interface Entry {
  Deputation_Id: number;
  Const_Id: number;
  Company_Name: string | null;
  Service_Type: ServiceType | null;
  Contact_Name: string | null;
  Contact_Designation: string | null;
  Contact_Mobile: string | null;
  Contact_Mobile2: string | null;
  Contact_Email: string | null;
  Initial_Discussion: string | null;
  Current_Phase: Phase | null;
  Proposal_Status: string | null;
  Agreement_Title: string | null;
  Agreement_Attachment: string | null;
  Deputation_Percentage: string | null;
  Agreement_Client_Name: string | null;
  Agreement_Client_Address: string | null;
  Agreement_Date: string | null;
  Agreement_Scope: string | null;
  Fee_Annual_CTC: string | null;
  Fee_Internship: string | null;
  Fee_Deputation_Monthly: string | null;
  Fee_Replacement_Period: string | null;
  Fee_Payment_Credit: string | null;
  Fee_Agreement_Tenure: string | null;
  Negotiation_Decision: string | null;
  Tenure_Details: string | null;
  JD_Shared: boolean;
  JD_Shared_Date: string | null;
  Created_By: string;
  negotiations: Discussion[];
  positions: Position[];
}

const today = () => new Date().toISOString().slice(0, 10);
const toDateInput = (v: string | null | undefined) => {
  if (!v) return '';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

const phaseOf = (e: Entry): Phase => (e.Current_Phase || 'proposal') as Phase;

/* ================ MAIN COMPONENT ================ */

export default function DeputationSection({ constId }: { constId: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [entryForm, setEntryForm] = useState({
    Service_Type: 'deputation' as ServiceType,
    Contact_Name: '',
    Contact_Designation: '',
    Contact_Mobile: '',
    Contact_Mobile2: '',
    Contact_Email: '',
    Initial_Discussion: '',
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const handleCreateEntry = async () => {
    if (!entryForm.Contact_Name.trim()) { setError('Contact name is required'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/masters/consultancy/deputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constId, ...entryForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setEntryForm({ Service_Type: 'deputation', Contact_Name: '', Contact_Designation: '', Contact_Mobile: '', Contact_Mobile2: '', Contact_Email: '', Initial_Discussion: '' });
      await fetchEntries();
      if (data.insertId) setExpandedId(Number(data.insertId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const patchEntry = async (id: number, patch: Partial<Entry>) => {
    setError('');
    const res = await fetch('/api/masters/consultancy/deputation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Update failed'); return; }
    fetchEntries();
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this deputation entry? The linked follow-up row will also be removed.')) return;
    await fetch(`/api/masters/consultancy/deputation?id=${id}`, { method: 'DELETE' });
    fetchEntries();
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {/* ---- New Entry Form ---- */}
      <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">New ATS Entry</h3>
              <p className="text-[10px] text-blue-100">A follow-up row is auto-created with purple tag</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Service Type */}
          <div>
            <label className={blueLabel}>Service Type</label>
            <div className="flex gap-2 mt-1">
              {(['deputation', 'permanent', 'contract'] as ServiceType[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEntryForm(f => ({ ...f, Service_Type: st }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                    entryForm.Service_Type === st
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={SERVICE_ICONS[st]} /></svg>
                  {SERVICE_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={blueLabel}>Contact Name <span className="text-red-500">*</span></label>
              <input className={blueInput} value={entryForm.Contact_Name} onChange={e => setEntryForm(f => ({ ...f, Contact_Name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label className={blueLabel}>Designation</label>
              <input className={blueInput} value={entryForm.Contact_Designation} onChange={e => setEntryForm(f => ({ ...f, Contact_Designation: e.target.value }))} placeholder="Role / title" />
            </div>
            <div>
              <label className={blueLabel}>Email</label>
              <input type="email" className={blueInput} value={entryForm.Contact_Email} onChange={e => setEntryForm(f => ({ ...f, Contact_Email: e.target.value }))} placeholder="name@company.com" />
            </div>
            <div>
              <label className={blueLabel}>Mobile Number</label>
              <input className={blueInput} value={entryForm.Contact_Mobile} onChange={e => setEntryForm(f => ({ ...f, Contact_Mobile: e.target.value }))} placeholder="Primary mobile" />
            </div>
            <div>
              <label className={blueLabel}>Alternate Number</label>
              <input className={blueInput} value={entryForm.Contact_Mobile2} onChange={e => setEntryForm(f => ({ ...f, Contact_Mobile2: e.target.value }))} placeholder="Secondary mobile" />
            </div>
          </div>
          <div>
            <label className={blueLabel}>Initial Discussion</label>
            <textarea className={blueTextarea} rows={2} value={entryForm.Initial_Discussion} onChange={e => setEntryForm(f => ({ ...f, Initial_Discussion: e.target.value }))} placeholder="Opening discussion, context, proposal details..." />
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreateEntry} disabled={saving} className={blueBtn}>
              {saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Create Entry</>}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Entries List ---- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Entries</h3>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{entries.length}</span>
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          )}
        </div>
        {!loading && entries.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 px-6 py-10 text-center">
            <svg className="w-10 h-10 mx-auto text-blue-300 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            <p className="text-sm text-blue-700 font-medium">No entries yet</p>
            <p className="text-xs text-blue-500 mt-1">Create your first entry above to start tracking</p>
          </div>
        )}
        <div className="space-y-3">
          {entries.map(entry => (
            <EntryCard
              key={entry.Deputation_Id}
              entry={entry}
              expanded={expandedId === entry.Deputation_Id}
              onToggleExpand={() => setExpandedId(prev => prev === entry.Deputation_Id ? null : entry.Deputation_Id)}
              onPatch={(patch) => patchEntry(entry.Deputation_Id, patch)}
              onDelete={() => deleteEntry(entry.Deputation_Id)}
              onRefresh={fetchEntries}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================ ENTRY CARD ================ */

function EntryCard({
  entry, expanded, onToggleExpand, onPatch, onDelete, onRefresh,
}: {
  entry: Entry; expanded: boolean; onToggleExpand: () => void;
  onPatch: (patch: Partial<Entry>) => void; onDelete: () => void; onRefresh: () => void;
}) {
  const current = phaseOf(entry);
  const declined = current === 'declined' || entry.Proposal_Status === 'declined' || entry.Negotiation_Decision === 'declined';

  const [editContact, setEditContact] = useState(false);
  const contactKey = `${entry.Contact_Name}|${entry.Contact_Designation}|${entry.Contact_Mobile}|${entry.Contact_Mobile2}|${entry.Contact_Email}`;
  const [contactForm, setContactForm] = useState({
    Contact_Name: entry.Contact_Name || '', Contact_Designation: entry.Contact_Designation || '',
    Contact_Mobile: entry.Contact_Mobile || '', Contact_Mobile2: entry.Contact_Mobile2 || '', Contact_Email: entry.Contact_Email || '',
  });
  const [prevContactKey, setPrevContactKey] = useState(contactKey);
  if (contactKey !== prevContactKey) {
    setPrevContactKey(contactKey);
    setContactForm({
      Contact_Name: entry.Contact_Name || '', Contact_Designation: entry.Contact_Designation || '',
      Contact_Mobile: entry.Contact_Mobile || '', Contact_Mobile2: entry.Contact_Mobile2 || '', Contact_Email: entry.Contact_Email || '',
    });
  }

  const serviceType = (entry.Service_Type as ServiceType) || 'deputation';
  const serviceColors = {
    deputation: 'from-blue-500 to-indigo-600',
    permanent: 'from-emerald-500 to-teal-600',
    contract: 'from-amber-500 to-orange-600',
  };

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm transition-all ${declined ? 'border-red-200 bg-red-50/20' : 'border-slate-200 bg-white hover:shadow-md'}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${serviceColors[serviceType]} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <button onClick={onToggleExpand} className="flex items-center gap-3 text-left flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <svg className={`w-4 h-4 text-white transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white truncate">{entry.Contact_Name || 'Unnamed contact'}</span>
                <span className="inline-flex items-center rounded-md bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">{SERVICE_LABELS[serviceType]}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap text-[11px] text-white/80">
                {entry.Contact_Designation && <span>{entry.Contact_Designation}</span>}
                {entry.Contact_Mobile && <span className="flex items-center gap-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>{entry.Contact_Mobile}</span>}
                {entry.Contact_Email && <span className="flex items-center gap-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>{entry.Contact_Email}</span>}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { onToggleExpand(); setTimeout(() => setEditContact(true), 100); }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Edit contact">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Phase strip */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <PhaseStrip current={declined ? 'declined' : current} />
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Contact edit */}
          {editContact && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700">Edit Contact Details</h4>
                <button onClick={() => setEditContact(false)} className="text-[11px] text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={blueLabel}>Name</label><input className={blueInput} value={contactForm.Contact_Name} onChange={e => setContactForm(f => ({ ...f, Contact_Name: e.target.value }))} /></div>
                <div><label className={blueLabel}>Designation</label><input className={blueInput} value={contactForm.Contact_Designation} onChange={e => setContactForm(f => ({ ...f, Contact_Designation: e.target.value }))} /></div>
                <div><label className={blueLabel}>Email</label><input className={blueInput} value={contactForm.Contact_Email} onChange={e => setContactForm(f => ({ ...f, Contact_Email: e.target.value }))} /></div>
                <div><label className={blueLabel}>Mobile</label><input className={blueInput} value={contactForm.Contact_Mobile} onChange={e => setContactForm(f => ({ ...f, Contact_Mobile: e.target.value }))} /></div>
                <div><label className={blueLabel}>Alternate</label><input className={blueInput} value={contactForm.Contact_Mobile2} onChange={e => setContactForm(f => ({ ...f, Contact_Mobile2: e.target.value }))} /></div>
                <div className="flex items-end"><button className={blueBtn} onClick={() => { onPatch(contactForm); setEditContact(false); }}>Save Contact</button></div>
              </div>
            </div>
          )}

          {/* PROPOSAL */}
          <DiscussionsPanel entry={entry} phase="deputation" title="Deputation Discussions" onRefresh={onRefresh} />

          {!declined && current === 'proposal' && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-800">Proposal Decision</p>
                  <p className="text-[11px] text-slate-500">Has the consultancy accepted the proposal?</p>
                </div>
                <div className="flex gap-2">
                  <button className={blueBtn} onClick={() => onPatch({ Proposal_Status: 'accepted', Current_Phase: 'agreement' })}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Accept
                  </button>
                  <button className={dangerBtnOutline} onClick={() => { if (confirm('Mark proposal as declined?')) onPatch({ Proposal_Status: 'declined', Current_Phase: 'declined' }); }}>
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AGREEMENT */}
          {['agreement', 'negotiation', 'signed', 'closed'].includes(current) && !declined && (
            <AgreementPanel entry={entry} onPatch={onPatch} />
          )}

          {/* NEGOTIATION */}
          {['negotiation', 'signed', 'closed'].includes(current) && !declined && (
            <>
              <DiscussionsPanel entry={entry} phase="negotiation" title="Negotiation Discussions" onRefresh={onRefresh} />
              {current === 'negotiation' && (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PHASE_ICONS.negotiation} /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">Negotiation Outcome</p>
                      <p className="text-[11px] text-slate-500">Proceed to signed phase or decline?</p>
                    </div>
                    <div className="flex gap-2">
                      <button className={blueBtn} onClick={() => onPatch({ Negotiation_Decision: 'proceed', Current_Phase: 'signed' })}>
                        Proceed to Signed
                      </button>
                      <button className={dangerBtnOutline} onClick={() => { if (confirm('Decline negotiation?')) onPatch({ Negotiation_Decision: 'declined', Current_Phase: 'declined' }); }}>
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SIGNED */}
          {['signed', 'closed'].includes(current) && !declined && (
            <SignedPanel entry={entry} onPatch={onPatch} onRefresh={onRefresh} />
          )}

          {/* CLOSING */}
          {current === 'closed' && !declined && <ClosingPanel entry={entry} onPatch={onPatch} />}

          {/* DECLINED */}
          {declined && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-red-800">
                  Declined {entry.Proposal_Status === 'declined' ? 'at proposal phase' : 'during negotiation'}
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">Discussions can still be added but phase actions are locked.</p>
              </div>
              <button className={blueBtnOutline} onClick={() => onPatch({
                Current_Phase: entry.Proposal_Status === 'declined' ? 'proposal' : 'negotiation',
                Proposal_Status: entry.Proposal_Status === 'declined' ? null : entry.Proposal_Status,
                Negotiation_Decision: entry.Negotiation_Decision === 'declined' ? null : entry.Negotiation_Decision,
              })}>
                Reopen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================ PHASE STRIP ================ */

function PhaseStrip({ current }: { current: Phase }) {
  if (current === 'declined') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 text-[11px] font-semibold">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        Declined
      </div>
    );
  }
  const currentIdx = PHASE_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0.5">
      {PHASE_ORDER.map((p, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={p} className="flex items-center gap-0.5">
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              active ? 'bg-blue-600 text-white shadow-sm' : done ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={done ? 2.5 : 1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={done ? 'M4.5 12.75l6 6 9-13.5' : PHASE_ICONS[p]} />
              </svg>
              {PHASE_LABELS[p]}
            </div>
            {idx < PHASE_ORDER.length - 1 && (
              <div className={`w-4 h-0.5 rounded-full ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================ DISCUSSIONS PANEL ================ */

function DiscussionsPanel({
  entry, phase, title, onRefresh,
}: {
  entry: Entry; phase: 'deputation' | 'negotiation'; title: string; onRefresh: () => void;
}) {
  const items = (entry.negotiations || []).filter(n => (n.Phase || 'negotiation') === phase);
  const [form, setForm] = useState({ Negotiation_Date: today(), Discussion: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ Negotiation_Date: '', Discussion: '' });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!form.Discussion.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/negotiations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deputationId: entry.Deputation_Id, Negotiation_Date: form.Negotiation_Date || null, Discussion: form.Discussion.trim(), Phase: phase }),
      });
      setForm({ Negotiation_Date: today(), Discussion: '' });
      onRefresh();
    } finally { setBusy(false); }
  };

  const saveEdit = async (id: number) => {
    if (!editForm.Discussion.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/negotiations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, Negotiation_Date: editForm.Negotiation_Date || null, Discussion: editForm.Discussion.trim() }),
      });
      setEditId(null);
      onRefresh();
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this discussion?')) return;
    await fetch(`/api/masters/consultancy/deputation/negotiations?id=${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PHASE_ICONS[phase === 'deputation' ? 'proposal' : 'negotiation']} /></svg>
          <h4 className="text-xs font-bold text-slate-700">{title}</h4>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{items.length}</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {phase === 'deputation' && entry.Initial_Discussion && (
          <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Initial Discussion</div>
            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{entry.Initial_Discussion}</div>
          </div>
        )}
        {items.length === 0 && !entry.Initial_Discussion && (
          <p className="text-[11px] text-slate-400 italic text-center py-2">No discussions logged yet</p>
        )}

        {/* Timeline */}
        <div className="space-y-0">
          {items.map((d, idx) => (
            <div key={d.ID} className="relative flex gap-3 pb-3">
              {idx < items.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-blue-200" />}
              <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center shrink-0 mt-0.5 relative z-10">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                {editId === d.ID ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div><label className={blueLabel}>Date</label><input type="date" className={blueInput} value={editForm.Negotiation_Date} onChange={e => setEditForm(f => ({ ...f, Negotiation_Date: e.target.value }))} /></div>
                      <div className="md:col-span-3"><label className={blueLabel}>Discussion</label><textarea className={blueTextarea} rows={2} value={editForm.Discussion} onChange={e => setEditForm(f => ({ ...f, Discussion: e.target.value }))} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button className={blueBtnOutline} onClick={() => setEditId(null)}>Cancel</button>
                      <button className={blueBtn} disabled={busy} onClick={() => saveEdit(d.ID)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="group rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 px-3 py-2 -mx-3 -my-0.5 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-blue-600">
                          {d.Negotiation_Date ? new Date(d.Negotiation_Date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                        </span>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap break-words mt-0.5 leading-relaxed">{d.Discussion}</p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setEditId(d.ID); setEditForm({ Negotiation_Date: toDateInput(d.Negotiation_Date), Discussion: d.Discussion }); }}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded-md"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
                        <button onClick={() => remove(d.ID)} className="p-1 text-red-400 hover:bg-red-50 rounded-md"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/20 p-3 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-end">
            <div>
              <label className={blueLabel}>Date</label>
              <input type="date" className={blueInput} value={form.Negotiation_Date} onChange={e => setForm(f => ({ ...f, Negotiation_Date: e.target.value }))} />
            </div>
            <div>
              <label className={blueLabel}>{phase === 'deputation' ? 'Discussion' : 'Negotiation Note'}</label>
              <textarea className={blueTextarea} rows={1} value={form.Discussion} onChange={e => setForm(f => ({ ...f, Discussion: e.target.value }))} placeholder="Key points, decisions, next steps..." />
            </div>
            <button onClick={add} disabled={busy || !form.Discussion.trim()} className={blueBtn}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================ AGREEMENT PANEL ================ */

function AgreementPanel({ entry, onPatch }: { entry: Entry; onPatch: (patch: Partial<Entry>) => void }) {
  const initForm = () => ({
    Agreement_Title: entry.Agreement_Title || '',
    Agreement_Attachment: entry.Agreement_Attachment || '',
    Deputation_Percentage: entry.Deputation_Percentage || '',
    Agreement_Client_Name: entry.Agreement_Client_Name || '',
    Agreement_Client_Address: entry.Agreement_Client_Address || '',
    Agreement_Date: entry.Agreement_Date || '',
    Agreement_Scope: entry.Agreement_Scope || '',
    Fee_Annual_CTC: entry.Fee_Annual_CTC || '8.33%',
    Fee_Internship: entry.Fee_Internship || '10% of Annual CTC (one-time fee)',
    Fee_Deputation_Monthly: entry.Fee_Deputation_Monthly || '20% of Monthly CTC or mutually agreed man-hour rate',
    Fee_Replacement_Period: entry.Fee_Replacement_Period || '15% of Annual CTC',
    Fee_Payment_Credit: entry.Fee_Payment_Credit || '30 days',
    Fee_Agreement_Tenure: entry.Fee_Agreement_Tenure || '12 months',
  });
  const [form, setForm] = useState(initForm);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formKey = JSON.stringify([
    entry.Agreement_Title, entry.Agreement_Attachment, entry.Deputation_Percentage,
    entry.Agreement_Client_Name, entry.Agreement_Client_Address, entry.Agreement_Date,
    entry.Agreement_Scope, entry.Fee_Annual_CTC, entry.Fee_Internship, entry.Fee_Deputation_Monthly,
    entry.Fee_Replacement_Period, entry.Fee_Payment_Credit, entry.Fee_Agreement_Tenure,
  ]);
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (formKey !== prevFormKey) {
    setPrevFormKey(formKey);
    setForm(initForm());
    setDirty(false);
  }

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/masters/consultancy/deputation/attachment', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) { setForm(f => ({ ...f, Agreement_Attachment: data.url })); setDirty(true); }
      else alert(data.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const save = () => {
    const patch: Partial<Entry> = {};
    for (const [k, v] of Object.entries(form)) { (patch as Record<string, unknown>)[k] = v || null; }
    onPatch(patch);
    setDirty(false);
  };

  const up = (field: string, value: string) => { setForm(f => ({ ...f, [field]: value })); setDirty(true); };

  const fmtDate = form.Agreement_Date
    ? new Date(form.Agreement_Date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '___ day of ________, 20__';
  const clientName = form.Agreement_Client_Name || '______________________________';
  const clientAddr = form.Agreement_Client_Address || 'having its registered office at ________________________________________________';

  const buildHtml = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Agreement - ${clientName}</title>
<style>
body{font-family:'Times New Roman',Times,serif;max-width:700px;margin:40px auto;padding:30px;font-size:13px;line-height:1.8;color:#1a1a1a}
h1{text-align:center;font-size:16px;margin-bottom:2px;text-transform:uppercase;letter-spacing:1px}
h2{text-align:center;font-size:15px;margin-top:0;text-transform:uppercase;letter-spacing:1px}
.section{font-weight:bold;margin-top:20px;margin-bottom:6px}
.sub{margin-left:20px;margin-bottom:6px;text-indent:-20px;padding-left:20px}
.recital{margin-left:28px;margin-bottom:6px;text-indent:-14px;padding-left:14px}
.sig-block{display:flex;justify-content:space-between;margin-top:60px;gap:40px}
.sig-box{border:1px solid #333;padding:16px 20px;flex:1}
.sig-box p{margin:4px 0}
@media print{body{margin:20px;padding:15px} @page{margin:20mm}}
</style></head><body>
<h1>MANPOWER SUPPLY AND RECRUITMENT</h1><h2>SERVICES AGREEMENT</h2>
<p>This Manpower Supply and Recruitment Services Agreement is made and entered into on this ${fmtDate} ("Effective Date").</p>
<p class="section">PARTIES</p>
<p><strong>Accent Techno Solutions Private Limited</strong>, a company incorporated under the Companies Act, 2013, having its registered office at 17/130, Anand Nagar, Nehru Road, Near Vakola Police Station, Santacruz (East), Mumbai – 400055, Maharashtra, India (hereinafter referred to as "ATS"), which expression shall include its successors and permitted assigns.</p>
<p><strong>AND</strong></p>
<p><strong>${clientName}</strong>, a company incorporated under the Companies Act, 1956/2013, ${clientAddr} (hereinafter referred to as the "Client"), which expression shall include its successors and permitted assigns.</p>
<p>ATS and the Client are hereinafter individually referred to as a "Party" and collectively as the "Parties".</p>
<p class="section">RECITALS</p>
<p class="recital">A. ATS is engaged in the business of providing engineering services and technical manpower recruitment services, including permanent hiring, contractual staffing, deputation, and payroll management services.</p>
<p class="recital">B. The Client desires to engage ATS for sourcing and/or deploying suitable candidates for its manpower requirements.</p>
<p class="recital">C. ATS has agreed to provide such services to the Client on the terms and conditions set forth herein.</p>
<p>NOW, THEREFORE, in consideration of the mutual covenants and promises contained herein, the Parties agree as follows:</p>
<p class="section">1. SCOPE OF SERVICES</p>
<p class="sub">1.1 ATS shall source, screen, and refer candidates to the Client based on job descriptions provided in writing by the Client.</p>
<p class="sub">1.2 ATS shall nominate one or more representatives as the primary point(s) of contact.</p>
<p class="sub">1.3 The Client shall independently evaluate candidates and make hiring decisions at its sole discretion.</p>
<p class="section">2. CLIENT OBLIGATIONS</p>
<p class="sub">2.1 The Client shall provide accurate job descriptions and compensation details.</p>
<p class="sub">2.2 The Client shall inform ATS in writing regarding interviews, selections, offers, and joining dates.</p>
<p class="sub">2.3 The Client shall reimburse travel expenses directly to candidates invited for interviews.</p>
<p class="section">3. VALIDITY OF CANDIDATE PROFILE</p>
<p class="sub">3.1 Candidate profiles shall remain valid for six (6) months from the date of submission.</p>
<p class="sub">3.2 If any candidate introduced by ATS joins within six (6) months, ATS shall be entitled to full applicable fees.</p>
<p class="sub">3.3 In case of duplicate profiles, the Client must notify ATS in writing prior to conducting interviews.</p>
<p class="section">4. REPLACEMENT GUARANTEE</p>
<p class="sub">4.1 If a candidate resigns or is terminated within ninety (90) days of joining, ATS shall provide a free one-time replacement within sixty (60) days, subject to a replacement fee.</p>
<p class="sub">4.2 Notice of the replacement requirement must be given within seven (7) days of the original candidate leaving.</p>
<p class="sub">4.3 This shall not be applicable under any circumstance involving retrenchment.</p>
<p class="section">5. FEES AND COMMERCIAL TERMS</p>
<p class="sub">5.1 Domestic hiring: <strong>${form.Fee_Annual_CTC}</strong> of Annual CTC (one-time fee).</p>
<p class="sub">5.2 Internship/trainee hiring: <strong>${form.Fee_Internship}</strong>.</p>
<p class="sub">5.3 Deputation / ATS Payroll Model: <strong>${form.Fee_Deputation_Monthly}</strong>.</p>
<p class="sub">5.4 Replacement/enhancement recruitment: <strong>${form.Fee_Replacement_Period}</strong>.</p>
<p class="section">6. PAYMENT TERMS</p>
<p class="sub">6.1 Invoice shall be raised upon candidate joining.</p>
<p class="sub">6.2 Payment credit period: <strong>${form.Fee_Payment_Credit}</strong> from date of invoice.</p>
<p class="sub">6.3 GST and applicable taxes shall be charged extra.</p>
<p class="sub">6.4 Delayed payments shall attract interest at 18% per annum.</p>
<p class="section">7. TERM AND TERMINATION</p>
<p class="sub">7.1 This Agreement shall remain valid for <strong>${form.Fee_Agreement_Tenure}</strong> from the Effective Date unless terminated earlier.</p>
<p class="sub">7.2 Either Party may terminate with thirty (30) days' written notice.</p>
<p class="sub">7.3 Termination shall not affect accrued payment obligations.</p>
<p class="section">8. CONFIDENTIALITY</p>
<p style="margin-left:20px">Both Parties shall maintain confidentiality of proprietary and candidate-related information and shall not disclose such information without prior written consent, except as required by law.</p>
<p class="section">9. DISPUTE RESOLUTION</p>
<p class="sub">9.1 Disputes shall be resolved amicably through mutual discussions.</p>
<p class="sub">9.2 Failing resolution, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.</p>
<p class="sub">9.3 Seat and venue of arbitration shall be Mumbai, Maharashtra.</p>
<p class="section">10. GOVERNING LAW</p>
<p style="margin-left:20px">This Agreement shall be governed by the laws of India and subject to the exclusive jurisdiction of courts at Mumbai.</p>
<p class="section">SIGNATURES</p>
<p>IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.</p>
<div class="sig-block"><div class="sig-box"><p><strong>For Accent Techno Solutions Pvt. Ltd.</strong></p><p style="margin-top:40px">____________________________</p><p>Name: Santosh Dinkar Mestry</p><p>Designation: Director</p><p>Date: ________________</p></div><div class="sig-box"><p><strong>For ${clientName} (Client)</strong></p><p style="margin-top:40px">____________________________</p><p>Name: ________________</p><p>Designation: ________________</p><p>Date: ________________</p></div></div>
</body></html>`;

  const printAgreement = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildHtml());
    w.document.close();
    w.print();
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PHASE_ICONS.agreement} /></svg>
          <h4 className="text-xs font-bold text-slate-700">Agreement Builder</h4>
        </div>
        <div className="flex items-center gap-2">
          <button className={showPreview ? blueBtn : blueBtnOutline} onClick={() => setShowPreview(p => !p)}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={showPreview ? 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'} /></svg>
            {showPreview ? 'Edit Terms' : 'Preview'}
          </button>
          <button className={blueBtnOutline} onClick={printAgreement}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12z" /></svg>
            Print
          </button>
          {entry.Current_Phase === 'agreement' && (
            <button className={blueBtn} onClick={() => onPatch({ Current_Phase: 'negotiation' })}>Proceed to Negotiation</button>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className="p-4 bg-gray-50">
          <div className="border border-gray-200 rounded-xl bg-white p-8 max-h-[600px] overflow-auto text-[11px] leading-relaxed shadow-inner" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
            <h3 className="text-center text-[14px] font-bold mb-0 uppercase tracking-wider">MANPOWER SUPPLY AND RECRUITMENT</h3>
            <h4 className="text-center text-[13px] font-bold mb-4 uppercase tracking-wider">SERVICES AGREEMENT</h4>
            <p className="mb-3">This Manpower Supply and Recruitment Services Agreement (&ldquo;Agreement&rdquo;) is made and entered into on this {fmtDate} (&ldquo;Effective Date&rdquo;).</p>
            <p className="font-bold mt-4 mb-1.5">PARTIES</p>
            <p className="mb-2"><strong>Accent Techno Solutions Private Limited</strong>, a company incorporated under the Companies Act, 2013, having its registered office at 17/130, Anand Nagar, Nehru Road, Near Vakola Police Station, Santacruz (East), Mumbai &ndash; 400055, Maharashtra, India (hereinafter referred to as &ldquo;ATS&rdquo;).</p>
            <p className="font-bold mb-1">AND</p>
            <p className="mb-3"><strong>{clientName}</strong>, a company incorporated under the Companies Act, 1956/2013, {clientAddr} (hereinafter referred to as the &ldquo;Client&rdquo;).</p>
            <p className="mb-3">ATS and the Client are hereinafter individually referred to as a &ldquo;Party&rdquo; and collectively as the &ldquo;Parties&rdquo;.</p>
            <p className="font-bold mt-4 mb-1.5">RECITALS</p>
            <p className="ml-5 mb-1">A. ATS is engaged in the business of providing engineering services and technical manpower recruitment services, including permanent hiring, contractual staffing, deputation, and payroll management services.</p>
            <p className="ml-5 mb-1">B. The Client desires to engage ATS for sourcing and/or deploying suitable candidates for its manpower requirements.</p>
            <p className="ml-5 mb-3">C. ATS has agreed to provide such services to the Client on the terms and conditions set forth herein.</p>
            <p className="mb-3">NOW, THEREFORE, in consideration of the mutual covenants and promises contained herein, the Parties agree as follows:</p>
            {[
              { t: '1. SCOPE OF SERVICES', items: ['1.1 ATS shall source, screen, and refer candidates to the Client based on job descriptions provided in writing by the Client.', '1.2 ATS shall nominate one or more representatives as the primary point(s) of contact.', '1.3 The Client shall independently evaluate candidates and make hiring decisions at its sole discretion.'] },
              { t: '2. CLIENT OBLIGATIONS', items: ['2.1 The Client shall provide accurate job descriptions and compensation details.', '2.2 The Client shall inform ATS in writing regarding interviews, selections, offers, and joining dates.', '2.3 The Client shall reimburse travel expenses directly to candidates invited for interviews.'] },
              { t: '3. VALIDITY OF CANDIDATE PROFILE', items: ['3.1 Candidate profiles shall remain valid for six (6) months from the date of submission.', '3.2 If any candidate introduced by ATS joins within six (6) months, ATS shall be entitled to full applicable fees.', '3.3 In case of duplicate profiles, the Client must notify ATS in writing prior to conducting interviews.'] },
              { t: '4. REPLACEMENT GUARANTEE', items: ['4.1 If a candidate resigns or is terminated within ninety (90) days of joining, ATS shall provide a free one-time replacement within sixty (60) days, subject to a replacement fee.', '4.2 Notice must be given within seven (7) days of the original candidate leaving.', '4.3 This shall not be applicable under any circumstance involving retrenchment.'] },
            ].map(s => (<div key={s.t}><p className="font-bold mt-3 mb-1">{s.t}</p>{s.items.map(i => <p key={i} className="ml-5 mb-1">{i}</p>)}</div>))}
            <p className="font-bold mt-3 mb-1 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200">5. FEES AND COMMERCIAL TERMS</p>
            <p className="ml-5 mb-1">5.1 Domestic hiring: <strong className="text-blue-700">{form.Fee_Annual_CTC}</strong> of Annual CTC (one-time fee).</p>
            <p className="ml-5 mb-1">5.2 Internship/trainee hiring: <strong className="text-blue-700">{form.Fee_Internship}</strong>.</p>
            <p className="ml-5 mb-1">5.3 Deputation / ATS Payroll Model: <strong className="text-blue-700">{form.Fee_Deputation_Monthly}</strong>.</p>
            <p className="ml-5 mb-1">5.4 Replacement/enhancement recruitment: <strong className="text-blue-700">{form.Fee_Replacement_Period}</strong>.</p>
            <p className="font-bold mt-3 mb-1">6. PAYMENT TERMS</p>
            <p className="ml-5 mb-1">6.1 Invoice shall be raised upon candidate joining.</p>
            <p className="ml-5 mb-1">6.2 Payment credit period: <strong className="text-blue-700">{form.Fee_Payment_Credit}</strong> from date of invoice.</p>
            <p className="ml-5 mb-1">6.3 GST and applicable taxes shall be charged extra.</p>
            <p className="ml-5 mb-1">6.4 Delayed payments shall attract interest at 18% per annum.</p>
            <p className="font-bold mt-3 mb-1">7. TERM AND TERMINATION</p>
            <p className="ml-5 mb-1">7.1 This Agreement shall remain valid for <strong className="text-blue-700">{form.Fee_Agreement_Tenure}</strong> from the Effective Date unless terminated earlier.</p>
            <p className="ml-5 mb-1">7.2 Either Party may terminate with thirty (30) days&rsquo; written notice.</p>
            <p className="ml-5 mb-1">7.3 Termination shall not affect accrued payment obligations.</p>
            {[
              { t: '8. CONFIDENTIALITY', p: 'Both Parties shall maintain confidentiality of proprietary and candidate-related information and shall not disclose such information without prior written consent, except as required by law.' },
            ].map(s => (<div key={s.t}><p className="font-bold mt-3 mb-1">{s.t}</p><p className="ml-5 mb-1">{s.p}</p></div>))}
            <p className="font-bold mt-3 mb-1">9. DISPUTE RESOLUTION</p>
            <p className="ml-5 mb-1">9.1 Disputes shall be resolved amicably through mutual discussions.</p>
            <p className="ml-5 mb-1">9.2 Failing resolution, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.</p>
            <p className="ml-5 mb-1">9.3 Seat and venue of arbitration shall be Mumbai, Maharashtra.</p>
            <p className="font-bold mt-3 mb-1">10. GOVERNING LAW</p>
            <p className="ml-5 mb-3">This Agreement shall be governed by the laws of India and subject to the exclusive jurisdiction of courts at Mumbai.</p>
            <p className="font-bold mt-4 mb-1">SIGNATURES</p>
            <p className="mb-4">IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.</p>
            <div className="flex gap-4">
              <div className="flex-1 border border-gray-300 p-4 rounded-lg"><p className="font-bold text-[10px] mb-8">For Accent Techno Solutions Pvt. Ltd.</p><div className="border-b border-gray-300 mb-2" /><p className="text-[10px]">Name: Santosh Dinkar Mestry</p><p className="text-[10px]">Designation: Director</p><p className="text-[10px]">Date: ________________</p></div>
              <div className="flex-1 border border-gray-300 p-4 rounded-lg"><p className="font-bold text-[10px] mb-8">For {clientName} (Client)</p><div className="border-b border-gray-300 mb-2" /><p className="text-[10px]">Name: ________________</p><p className="text-[10px]">Designation: ________________</p><p className="text-[10px]">Date: ________________</p></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              Client Party &amp; Effective Date
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={blueLabel}>Client Company Name</label><input className={blueInput} value={form.Agreement_Client_Name} onChange={e => up('Agreement_Client_Name', e.target.value)} placeholder="Full legal name" /></div>
              <div><label className={blueLabel}>Registered Office Address</label><input className={blueInput} value={form.Agreement_Client_Address} onChange={e => up('Agreement_Client_Address', e.target.value)} placeholder="Address" /></div>
              <div><label className={blueLabel}>Effective Date</label><input type="date" className={blueInput} value={form.Agreement_Date} onChange={e => up('Agreement_Date', e.target.value)} /></div>
            </div>
          </div>

          <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4">
            <p className="text-[10px] font-bold text-blue-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
              Fees &amp; Commercial Terms
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={blueLabel}>5.1 Domestic Hiring (% of Annual CTC)</label><input className={blueInput} value={form.Fee_Annual_CTC} onChange={e => up('Fee_Annual_CTC', e.target.value)} /></div>
              <div><label className={blueLabel}>5.2 Internship / Trainee Hiring</label><input className={blueInput} value={form.Fee_Internship} onChange={e => up('Fee_Internship', e.target.value)} /></div>
              <div><label className={blueLabel}>5.3 Deputation / ATS Payroll Model</label><input className={blueInput} value={form.Fee_Deputation_Monthly} onChange={e => up('Fee_Deputation_Monthly', e.target.value)} /></div>
              <div><label className={blueLabel}>5.4 Replacement / Enhancement</label><input className={blueInput} value={form.Fee_Replacement_Period} onChange={e => up('Fee_Replacement_Period', e.target.value)} /></div>
              <div><label className={blueLabel}>6.2 Payment Credit Period</label><input className={blueInput} value={form.Fee_Payment_Credit} onChange={e => up('Fee_Payment_Credit', e.target.value)} /></div>
              <div><label className={blueLabel}>7.1 Agreement Tenure</label><input className={blueInput} value={form.Fee_Agreement_Tenure} onChange={e => up('Fee_Agreement_Tenure', e.target.value)} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={blueLabel}>Agreement Reference Title</label><input className={blueInput} value={form.Agreement_Title} onChange={e => up('Agreement_Title', e.target.value)} placeholder="e.g. MSA-2026-Client" /></div>
            <div>
              <label className={blueLabel}>Signed Agreement Attachment</label>
              <div className="flex items-center gap-2">
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={uploading} />
                {uploading && <span className="text-[11px] text-blue-600">Uploading...</span>}
                {form.Agreement_Attachment && <a href={form.Agreement_Attachment} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline font-medium">View</a>}
              </div>
            </div>
          </div>

          <div className="flex justify-end"><button className={blueBtn} disabled={!dirty} onClick={save}>Save Agreement</button></div>
        </div>
      )}
    </div>
  );
}

/* ================ SIGNED PANEL ================ */

function SignedPanel({ entry, onPatch, onRefresh }: { entry: Entry; onPatch: (patch: Partial<Entry>) => void; onRefresh: () => void }) {
  const [posForm, setPosForm] = useState({ Position_Title: '', Total_Requirement: '', Short_Description: '', Working_Location: '' });
  const [busy, setBusy] = useState(false);

  const addPosition = async () => {
    if (!posForm.Position_Title.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/positions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deputationId: entry.Deputation_Id, Position_Title: posForm.Position_Title.trim(), Total_Requirement: posForm.Total_Requirement || null, Short_Description: posForm.Short_Description.trim() || null, Working_Location: posForm.Working_Location.trim() || null }),
      });
      setPosForm({ Position_Title: '', Total_Requirement: '', Short_Description: '', Working_Location: '' });
      onRefresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PHASE_ICONS.signed} /></svg>
          <h4 className="text-xs font-bold text-slate-700">JDs &amp; Positions</h4>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPatch({ JD_Shared: !entry.JD_Shared, JD_Shared_Date: !entry.JD_Shared ? (entry.JD_Shared_Date || today()) : null })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
              entry.JD_Shared ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}>
            {entry.JD_Shared ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> JD Shared{entry.JD_Shared_Date ? ` · ${toDateInput(entry.JD_Shared_Date)}` : ''}</> : 'Mark JD Shared'}
          </button>
          {entry.Current_Phase === 'signed' && <button className={blueBtn} onClick={() => onPatch({ Current_Phase: 'closed' })}>Move to Closing</button>}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {entry.JD_Shared && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Shared on:</label>
            <input type="date" className={`${blueInput} max-w-[160px]`} value={toDateInput(entry.JD_Shared_Date)} onChange={e => onPatch({ JD_Shared_Date: e.target.value || null })} />
          </div>
        )}
        {(entry.positions || []).length === 0 && <p className="text-[11px] text-slate-400 italic text-center py-3">No positions added yet</p>}
        {(entry.positions || []).map(p => <PositionBlock key={p.ID} position={p} onRefresh={onRefresh} />)}

        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/20 p-3">
          <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Add Position</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div><label className={blueLabel}>Title</label><input className={blueInput} value={posForm.Position_Title} onChange={e => setPosForm(f => ({ ...f, Position_Title: e.target.value }))} placeholder="e.g. Senior Analyst" /></div>
            <div><label className={blueLabel}>Requirement</label><input type="number" min={0} className={blueInput} value={posForm.Total_Requirement} onChange={e => setPosForm(f => ({ ...f, Total_Requirement: e.target.value }))} placeholder="e.g. 3" /></div>
            <div><label className={blueLabel}>Location</label><input className={blueInput} value={posForm.Working_Location} onChange={e => setPosForm(f => ({ ...f, Working_Location: e.target.value }))} placeholder="e.g. Mumbai" /></div>
            <div className="flex items-end"><button onClick={addPosition} disabled={busy || !posForm.Position_Title.trim()} className={`w-full ${blueBtn}`}>Add</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================ POSITION BLOCK ================ */

function PositionBlock({ position, onRefresh }: { position: Position; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    Position_Title: position.Position_Title || '', Total_Requirement: position.Total_Requirement != null ? String(position.Total_Requirement) : '',
    Short_Description: position.Short_Description || '', Working_Location: position.Working_Location || '', Interview_Arrangement: position.Interview_Arrangement || '',
  });
  const [candForm, setCandForm] = useState({ Candidate_Name: '', Mobile: '', Email: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      Position_Title: position.Position_Title || '', Total_Requirement: position.Total_Requirement != null ? String(position.Total_Requirement) : '',
      Short_Description: position.Short_Description || '', Working_Location: position.Working_Location || '', Interview_Arrangement: position.Interview_Arrangement || '',
    });
  }, [position.Position_Title, position.Total_Requirement, position.Short_Description, position.Working_Location, position.Interview_Arrangement]);

  const savePosition = async () => {
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/positions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: position.ID, ...form, Status: position.Status, Went_Ahead: position.Went_Ahead, Joining_Date: position.Joining_Date, Closed_By: position.Closed_By, Closing_Notes: position.Closing_Notes }),
      });
      setEditing(false); onRefresh();
    } finally { setBusy(false); }
  };

  const addCandidate = async () => {
    if (!candForm.Candidate_Name.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: position.ID, deputationId: position.Deputation_Id, Candidate_Name: candForm.Candidate_Name.trim(), Mobile: candForm.Mobile || null, Email: candForm.Email || null }),
      });
      setCandForm({ Candidate_Name: '', Mobile: '', Email: '' }); onRefresh();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Delete this position?')) return;
    await fetch(`/api/masters/consultancy/deputation/positions?id=${position.ID}`, { method: 'DELETE' }); onRefresh();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{position.Position_Title || 'Untitled'}</span>
            {position.Total_Requirement != null && <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">Req: {position.Total_Requirement}</span>}
            {position.Working_Location && <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold">{position.Working_Location}</span>}
            <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-[10px] font-semibold">{position.candidates?.length ?? 0} candidate{position.candidates?.length === 1 ? '' : 's'}</span>
          </div>
          {position.Short_Description && <p className="text-[11px] text-slate-500 mt-1">{position.Short_Description}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => setEditing(v => !v)} title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
          <button className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" onClick={remove} title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
        </div>
      </div>

      {editing && (
        <div className="p-4 border-b border-slate-100 bg-blue-50/20 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div><label className={blueLabel}>Title</label><input className={blueInput} value={form.Position_Title} onChange={e => setForm(f => ({ ...f, Position_Title: e.target.value }))} /></div>
            <div><label className={blueLabel}>Requirement</label><input type="number" className={blueInput} value={form.Total_Requirement} onChange={e => setForm(f => ({ ...f, Total_Requirement: e.target.value }))} /></div>
            <div><label className={blueLabel}>Location</label><input className={blueInput} value={form.Working_Location} onChange={e => setForm(f => ({ ...f, Working_Location: e.target.value }))} /></div>
          </div>
          <div><label className={blueLabel}>Short Description</label><textarea className={blueTextarea} rows={2} value={form.Short_Description} onChange={e => setForm(f => ({ ...f, Short_Description: e.target.value }))} /></div>
          <div><label className={blueLabel}>Interview Arrangement</label><textarea className={blueTextarea} rows={2} value={form.Interview_Arrangement} onChange={e => setForm(f => ({ ...f, Interview_Arrangement: e.target.value }))} placeholder="Mode, rounds, logistics..." /></div>
          <div className="flex justify-end gap-2">
            <button className={blueBtnOutline} onClick={() => setEditing(false)}>Cancel</button>
            <button className={blueBtn} disabled={busy} onClick={savePosition}>Save</button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Candidates</p>
        {(position.candidates || []).length === 0 && <p className="text-[11px] text-slate-400 italic text-center py-2">No candidates added</p>}
        {(position.candidates || []).map(c => <CandidateRow key={c.ID} candidate={c} onRefresh={onRefresh} />)}
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div><label className={blueLabel}>Name</label><input className={blueInput} value={candForm.Candidate_Name} onChange={e => setCandForm(f => ({ ...f, Candidate_Name: e.target.value }))} placeholder="Full name" /></div>
            <div><label className={blueLabel}>Mobile</label><input className={blueInput} value={candForm.Mobile} onChange={e => setCandForm(f => ({ ...f, Mobile: e.target.value }))} /></div>
            <div><label className={blueLabel}>Email</label><input className={blueInput} value={candForm.Email} onChange={e => setCandForm(f => ({ ...f, Email: e.target.value }))} /></div>
            <button onClick={addCandidate} disabled={busy || !candForm.Candidate_Name.trim()} className={blueBtn}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================ CANDIDATE ROW ================ */

function CandidateRow({ candidate, onRefresh }: { candidate: Candidate; onRefresh: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    Candidate_Name: candidate.Candidate_Name || '', Mobile: candidate.Mobile || '', Email: candidate.Email || '',
    Status: candidate.Status || 'Shortlisted', Offer_Letter_Shared: candidate.Offer_Letter_Shared,
    Offer_Letter_Date: toDateInput(candidate.Offer_Letter_Date), Joining_Date: toDateInput(candidate.Joining_Date), Notes: candidate.Notes || '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      Candidate_Name: candidate.Candidate_Name || '', Mobile: candidate.Mobile || '', Email: candidate.Email || '',
      Status: candidate.Status || 'Shortlisted', Offer_Letter_Shared: candidate.Offer_Letter_Shared,
      Offer_Letter_Date: toDateInput(candidate.Offer_Letter_Date), Joining_Date: toDateInput(candidate.Joining_Date), Notes: candidate.Notes || '',
    });
  }, [candidate]);

  const patch = async (payload: Partial<typeof form>) => {
    setBusy(true);
    try {
      await fetch('/api/masters/consultancy/deputation/candidates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: candidate.ID, ...payload }) });
      onRefresh();
    } finally { setBusy(false); }
  };
  const saveAll = () => patch(form).then(() => setEdit(false));
  const remove = async () => { if (confirm('Delete this candidate?')) { await fetch(`/api/masters/consultancy/deputation/candidates?id=${candidate.ID}`, { method: 'DELETE' }); onRefresh(); } };

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    Selected: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Rejected: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    Interviewed: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    Shortlisted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  };
  const sc = statusConfig[candidate.Status] || statusConfig.Shortlisted;

  return (
    <div className="rounded-lg border border-slate-150 bg-white hover:shadow-sm transition-all">
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full ${sc.bg} flex items-center justify-center shrink-0`}>
          <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-800">{candidate.Candidate_Name || 'Unnamed'}</span>
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>{candidate.Status}</span>
            {candidate.Status === 'Selected' && candidate.Offer_Letter_Shared && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Offer Shared
              </span>
            )}
            {candidate.Joining_Date && <span className="text-[10px] text-slate-500">Joining {toDateInput(candidate.Joining_Date)}</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {candidate.Mobile && <span>{candidate.Mobile}</span>}
            {candidate.Mobile && candidate.Email && <span className="mx-1">·</span>}
            {candidate.Email && <span>{candidate.Email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={candidate.Status} onChange={e => patch({ Status: e.target.value })}>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Interviewed">Interviewed</option>
            <option value="Selected">Selected</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => setEdit(v => !v)} title="Edit"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
          <button className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" onClick={remove} title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      </div>
      {edit && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div><label className={blueLabel}>Name</label><input className={blueInput} value={form.Candidate_Name} onChange={e => setForm(f => ({ ...f, Candidate_Name: e.target.value }))} /></div>
            <div><label className={blueLabel}>Mobile</label><input className={blueInput} value={form.Mobile} onChange={e => setForm(f => ({ ...f, Mobile: e.target.value }))} /></div>
            <div><label className={blueLabel}>Email</label><input className={blueInput} value={form.Email} onChange={e => setForm(f => ({ ...f, Email: e.target.value }))} /></div>
            <div><label className={blueLabel}>Status</label><select className={blueSelect} value={form.Status} onChange={e => setForm(f => ({ ...f, Status: e.target.value }))}><option value="Shortlisted">Shortlisted</option><option value="Interviewed">Interviewed</option><option value="Selected">Selected</option><option value="Rejected">Rejected</option></select></div>
          </div>
          {form.Status === 'Selected' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
              <div className="flex items-center gap-2">
                <input id={`ol-${candidate.ID}`} type="checkbox" className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" checked={form.Offer_Letter_Shared} onChange={e => setForm(f => ({ ...f, Offer_Letter_Shared: e.target.checked }))} />
                <label htmlFor={`ol-${candidate.ID}`} className="text-[11px] font-semibold text-emerald-800">Offer letter shared</label>
              </div>
              <div><label className={blueLabel}>Offer Letter Date</label><input type="date" className={blueInput} value={form.Offer_Letter_Date} onChange={e => setForm(f => ({ ...f, Offer_Letter_Date: e.target.value }))} /></div>
              <div><label className={blueLabel}>Joining Date</label><input type="date" className={blueInput} value={form.Joining_Date} onChange={e => setForm(f => ({ ...f, Joining_Date: e.target.value }))} /></div>
            </div>
          )}
          <div><label className={blueLabel}>Notes</label><textarea className={blueTextarea} rows={2} value={form.Notes} onChange={e => setForm(f => ({ ...f, Notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <button className={blueBtnOutline} onClick={() => setEdit(false)}>Cancel</button>
            <button className={blueBtn} disabled={busy} onClick={saveAll}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================ CLOSING PANEL ================ */

function ClosingPanel({ entry, onPatch }: { entry: Entry; onPatch: (patch: Partial<Entry>) => void }) {
  const [tenure, setTenure] = useState(entry.Tenure_Details || '');
  const [dirty, setDirty] = useState(false);
  const [prevTenure, setPrevTenure] = useState(entry.Tenure_Details);
  if (entry.Tenure_Details !== prevTenure) {
    setPrevTenure(entry.Tenure_Details);
    setTenure(entry.Tenure_Details || '');
    setDirty(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={PHASE_ICONS.closed} /></svg>
        <h4 className="text-xs font-bold text-slate-700">Closing &middot; Tenure Details</h4>
      </div>
      <div className="p-4 space-y-3">
        <textarea className={blueTextarea} rows={3} value={tenure} onChange={e => { setTenure(e.target.value); setDirty(true); }} placeholder="Tenure duration, end date, renewal terms, billing cycle notes..." />
        <div className="flex justify-end">
          <button className={blueBtn} disabled={!dirty} onClick={() => { onPatch({ Tenure_Details: tenure || null }); setDirty(false); }}>Save Tenure</button>
        </div>
      </div>
    </div>
  );
}
