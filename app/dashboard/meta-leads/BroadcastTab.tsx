'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Receiver {
  key: string; // unique across sources: `meta:${MetaLead_Id}` or `csv:${index}`
  metaLeadId?: string | null;
  name: string | null;
  phone: string;
  source: 'training' | 'csv' | 'meta' | 'filters';
}

interface MetaLeadOption {
  MetaLead_Id: string;
  Student_Name: string;
  Present_Mobile: string | null;
  TrainingProgramme?: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Inquiry_Dt: string | null;
}

interface TemplateOption {
  key: string;
  label: string;
  configured: boolean;
  editableVariable: string;
}

type ReceiverTab = 'training' | 'csv' | 'meta' | 'filters';

const ctrl =
  'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] placeholder:text-slate-400 transition-colors';

async function fetchMetaLeads(params: URLSearchParams): Promise<MetaLeadOption[]> {
  const res = await fetch(`/api/meta-ads/leads?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch leads');
  const data = await res.json();
  return (data.rows || []) as MetaLeadOption[];
}

export default function BroadcastTab() {
  const [receiverTab, setReceiverTab] = useState<ReceiverTab>('training');

  // Selected receivers, keyed so the same person isn't double-added across tabs.
  const [selected, setSelected] = useState<Map<string, Receiver>>(new Map());

  // -- Training Program tab --
  const [trainingOptions, setTrainingOptions] = useState<string[]>([]);
  const [selectedTraining, setSelectedTraining] = useState('');
  const [trainingLeads, setTrainingLeads] = useState<MetaLeadOption[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);

  // -- Custom CSV tab --
  const [csvRows, setCsvRows] = useState<{ name: string | null; phone: string }[]>([]);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Meta tab --
  const [metaSearch, setMetaSearch] = useState('');
  const [metaLeads, setMetaLeads] = useState<MetaLeadOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  // -- More Filters tab --
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterLeads, setFilterLeads] = useState<MetaLeadOption[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [statusOptions, setStatusOptions] = useState<{ id: number; label: string }[]>([]);

  // -- Message / templates --
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  // Overrides the template's editable "name" variable for every recipient in
  // this broadcast. Empty = use each recipient's own first name (default).
  const [nameParamOverride, setNameParamOverride] = useState('');

  // -- Send --
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number; failedCount: number; failed: { phone: string; reason?: string }[] } | null>(null);
  const [sendError, setSendError] = useState('');

  // Load filter/training options + templates once.
  useEffect(() => {
    fetch('/api/meta-ads/leads?limit=1')
      .then((r) => r.json())
      .then((data) => {
        setTrainingOptions(data?.filters?.trainings || []);
        setStatusOptions(data?.filters?.statusOptions || []);
      })
      .catch(() => {});
    fetch('/api/meta-ads/whatsapp/broadcast')
      .then((r) => r.json())
      .then((data) => {
        const opts = (data.templates || []) as TemplateOption[];
        setTemplates(opts);
        if (opts.length > 0) setSelectedTemplate(opts[0].key);
      })
      .catch(() => {});
  }, []);

  // Training Program tab: fetch leads when a program is picked.
  useEffect(() => {
    if (receiverTab !== 'training' || !selectedTraining) {
      setTrainingLeads([]);
      return;
    }
    setTrainingLoading(true);
    fetchMetaLeads(new URLSearchParams({ training: selectedTraining, limit: '100' }))
      .then(setTrainingLeads)
      .catch(() => setTrainingLeads([]))
      .finally(() => setTrainingLoading(false));
  }, [receiverTab, selectedTraining]);

  // Meta tab: fetch/search leads.
  const doMetaSearch = useCallback(() => {
    setMetaLoading(true);
    fetchMetaLeads(new URLSearchParams({ search: metaSearch, limit: '100' }))
      .then(setMetaLeads)
      .catch(() => setMetaLeads([]))
      .finally(() => setMetaLoading(false));
  }, [metaSearch]);

  useEffect(() => {
    if (receiverTab === 'meta' && metaLeads.length === 0 && !metaLoading) doMetaSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiverTab]);

  // More Filters tab.
  const doFilterSearch = useCallback(() => {
    setFilterLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterDateFrom) params.set('dateFrom', filterDateFrom);
    if (filterDateTo) params.set('dateTo', filterDateTo);
    fetchMetaLeads(params)
      .then(setFilterLeads)
      .catch(() => setFilterLeads([]))
      .finally(() => setFilterLoading(false));
  }, [filterStatus, filterDateFrom, filterDateTo]);

  function toggleReceiver(receiver: Receiver) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(receiver.key)) next.delete(receiver.key);
      else next.set(receiver.key, receiver);
      return next;
    });
  }

  function toggleAll(rows: Receiver[]) {
    setSelected((prev) => {
      const next = new Map(prev);
      const allSelected = rows.length > 0 && rows.every((r) => next.has(r.key));
      for (const r of rows) {
        if (allSelected) next.delete(r.key);
        else next.set(r.key, r);
      }
      return next;
    });
  }

  function applyParsedRows(fileLabel: string, fields: string[], data: Record<string, string>[]) {
    const phoneField = fields.find((f) => f.toLowerCase().trim().includes('phone') || f.toLowerCase().trim().includes('mobile'));
    const nameField = fields.find((f) => f.toLowerCase().trim().includes('name'));
    if (!phoneField) {
      setCsvError(`${fileLabel} must have a column containing "phone" or "mobile" (found: ${fields.map((f) => f.toLowerCase().trim()).join(', ') || 'none'})`);
      setCsvRows([]);
      return;
    }
    const parsed = data
      .map((row) => ({ name: nameField ? String(row[nameField] ?? '').trim() || null : null, phone: String(row[phoneField] ?? '').trim() }))
      .filter((row) => row.phone);
    setCsvRows(parsed);
    setSelected((prev) => {
      const next = new Map(prev);
      parsed.forEach((row, idx) => {
        const key = `csv:${idx}:${row.phone}`;
        next.set(key, { key, name: row.name, phone: row.phone, source: 'csv' });
      });
      return next;
    });
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => applyParsedRows('CSV', results.meta.fields || [], results.data),
        error: (err) => setCsvError(err.message || 'Failed to parse CSV'),
      });
      return;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      file
        .arrayBuffer()
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) {
            setCsvError('Workbook has no sheets');
            return;
          }
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[firstSheet], { defval: '' });
          const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
          applyParsedRows('Excel file', fields, rows);
        })
        .catch((err) => setCsvError(err instanceof Error ? err.message : 'Failed to parse Excel file'));
      return;
    }

    setCsvError('Unsupported file type — upload a .csv, .xls, or .xlsx file');
  }

  const receiverList = useMemo(() => Array.from(selected.values()), [selected]);
  const canSend = receiverList.length > 0 && !!selectedTemplate && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setSendError('');
    setSendResult(null);
    try {
      const res = await fetch('/api/meta-ads/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: selectedTemplate,
          nameParamOverride: nameParamOverride.trim(),
          recipients: receiverList.map((r) => ({ metaLeadId: r.metaLeadId ? Number(r.metaLeadId) : null, name: r.name, phone: r.phone })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Broadcast failed');
      setSendResult({ sentCount: data.sentCount, failedCount: data.failedCount, failed: data.failed || [] });
      setSelected(new Map());
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Broadcast failed');
    } finally {
      setSending(false);
    }
  }

  function leadToReceiver(lead: MetaLeadOption, source: ReceiverTab): Receiver | null {
    if (!lead.Present_Mobile) return null;
    return { key: `meta:${lead.MetaLead_Id}`, metaLeadId: lead.MetaLead_Id, name: lead.Student_Name, phone: lead.Present_Mobile, source };
  }

  function renderLeadRows(leads: MetaLeadOption[], loading: boolean, source: ReceiverTab) {
    const rows = leads.map((l) => leadToReceiver(l, source)).filter((r): r is Receiver => r !== null);
    return (
      <div className="mt-2 border border-slate-100 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 border-b border-slate-100">
          <button type="button" onClick={() => toggleAll(rows)} className="text-[10px] font-semibold text-[#2A6BB5] hover:underline">
            {rows.length > 0 && rows.every((r) => selected.has(r.key)) ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-[10px] text-slate-400">{loading ? 'Loading…' : `${rows.length} found`}</span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
          {rows.length === 0 && !loading && <div className="px-3 py-4 text-center text-xs text-slate-400">No matching leads with a phone number</div>}
          {rows.map((r) => (
            <label key={r.key} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggleReceiver(r)} className="rounded border-slate-300" />
              <span className="font-medium text-slate-700 truncate">{r.name || 'Unnamed'}</span>
              <span className="text-slate-400 ml-auto shrink-0">{r.phone}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Select Receiver Data */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700 text-center">Select Receiver Data</h3>
        </div>
        <div className="grid grid-cols-4 border-b border-slate-200">
          {([
            ['training', 'Training Program'],
            ['csv', 'Custom CSV'],
            ['meta', 'Meta'],
            ['filters', '(More Filters)'],
          ] as [ReceiverTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReceiverTab(key)}
              className={`px-2 py-2 text-[11px] font-semibold border-r last:border-r-0 border-slate-200 transition-colors ${
                receiverTab === key ? 'bg-[#6366F1]/10 text-[#6366F1]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3 flex-1">
          {receiverTab === 'training' && (
            <div>
              <select value={selectedTraining} onChange={(e) => setSelectedTraining(e.target.value)} className={`${ctrl} w-full`}>
                <option value="">Select a training program…</option>
                {trainingOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {selectedTraining && renderLeadRows(trainingLeads, trainingLoading, 'training')}
            </div>
          )}

          {receiverTab === 'csv' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleCsvUpload}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#6366F1]/10 file:text-[#6366F1] hover:file:bg-[#6366F1]/20"
              />
              <p className="mt-1.5 text-[10px] text-slate-400">CSV or Excel (.xls / .xlsx) — needs a column with &quot;phone&quot; or &quot;mobile&quot; in the header, and optionally a &quot;name&quot; column.</p>
              {csvError && <p className="mt-1.5 text-[10px] text-red-500">{csvError}</p>}
              {csvRows.length > 0 && (
                <div className="mt-2 border border-slate-100 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-500">{csvRows.length} rows parsed and selected</div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {csvRows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="font-medium text-slate-700 truncate">{row.name || 'Unnamed'}</span>
                        <span className="text-slate-400 ml-auto shrink-0">{row.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {receiverTab === 'meta' && (
            <div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={metaSearch}
                  onChange={(e) => setMetaSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doMetaSearch()}
                  placeholder="Search name, mobile, email…"
                  className={`${ctrl} flex-1`}
                />
                <button type="button" onClick={doMetaSearch} className="px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#6366F1]/90">
                  Search
                </button>
              </div>
              {renderLeadRows(metaLeads, metaLoading, 'meta')}
            </div>
          )}

          {receiverTab === 'filters' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={ctrl}>
                  <option value="">Any status</option>
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <div />
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={ctrl} />
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={ctrl} />
              </div>
              <button type="button" onClick={doFilterSearch} className="px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#6366F1]/90">
                Apply filters
              </button>
              {renderLeadRows(filterLeads, filterLoading, 'filters')}
            </div>
          )}
        </div>
      </div>

      {/* Right: Message / Templates + Send */}
      <div className="flex flex-col">
        <h3 className="text-xs font-bold text-slate-700 mb-1.5">Message</h3>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1 flex flex-col divide-y divide-slate-200">
          {templates.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">Loading templates…</div>}
          {templates.map((t) => (
            <div
              key={t.key}
              role="button"
              tabIndex={t.configured ? 0 : -1}
              aria-disabled={!t.configured}
              onClick={() => t.configured && setSelectedTemplate(t.key)}
              onKeyDown={(e) => t.configured && (e.key === 'Enter' || e.key === ' ') && setSelectedTemplate(t.key)}
              className={`flex-1 min-h-[110px] p-3 text-left transition-colors relative ${
                selectedTemplate === t.key ? 'bg-[#6366F1]/5 ring-2 ring-inset ring-[#6366F1]' : 'hover:bg-slate-50'
              } ${!t.configured ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-xs font-bold text-slate-700">{t.label}</span>
              {!t.configured && <span className="block mt-1 text-[10px] text-amber-600">Not configured — add the approved template name to enable</span>}
              {t.configured && selectedTemplate === t.key && (
                <>
                  <span className="absolute top-2 right-2 text-[#6366F1] text-[10px] font-bold">Selected</span>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Greeting variable ({`{{${t.editableVariable}}}`}) — the approved template wording itself can&apos;t be edited, only this value
                    </label>
                    <input
                      type="text"
                      value={nameParamOverride}
                      onChange={(e) => setNameParamOverride(e.target.value)}
                      placeholder="Default: each receiver's first name"
                      maxLength={60}
                      className={`${ctrl} w-full`}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {receiverList.length > 0 ? (
              <span><span className="font-bold text-slate-700">{receiverList.length}</span> receiver{receiverList.length === 1 ? '' : 's'} selected</span>
            ) : (
              'No receivers selected yet'
            )}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${
              canSend ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>

        {sendError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{sendError}</div>}
        {sendResult && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Sent {sendResult.sentCount} message{sendResult.sentCount === 1 ? '' : 's'}
            {sendResult.failedCount > 0 && `, ${sendResult.failedCount} failed`}.
            {sendResult.failed.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-red-600">
                {sendResult.failed.slice(0, 5).map((f, idx) => (
                  <li key={idx}>{f.phone}: {f.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
