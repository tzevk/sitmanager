'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
type ContentStatus = 'Not Started' | 'Planned' | 'Shot' | 'Edited' | 'Approved' | 'Posted';
type ViewMode = 'calendar' | 'planner';

interface ContentPlanRow {
  id: number;
  content_type: string;
  description: string | null;
  frequency: string;
  target_per_month: number;
  responsible_person: string;
  sort_order: number;
}

interface ContentItem {
  id: number;
  content_type: string;
  planned_date: string | null;
  execution_date: string | null;
  upload_date: string | null;
  status: ContentStatus;
  platform: string;
  responsible_person: string;
  description: string;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
}

interface MetaCampaignOption {
  id: string;
  name: string;
  leads: number;
  spend: number;
  cpl: number | null;
}

type FormItem = Partial<ContentItem> & { platforms?: string[] };

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG = [
  { name: 'Reel',      short: 'RL', color: '#4C1D95', bg: '#C4B5FD' },
  { name: 'Story',     short: 'ST', color: '#1E3A8A', bg: '#93C5FD' },
  { name: 'Post',      short: 'PO', color: '#064E3B', bg: '#6EE7B7' },
  { name: 'Video',     short: 'VD', color: '#7C2D12', bg: '#FDBA74' },
  { name: 'Carousel',  short: 'CR', color: '#831843', bg: '#F9A8D4' },
  { name: 'Blog',      short: 'BL', color: '#042F2E', bg: '#5EEAD4' },
  { name: 'Campaign',  short: 'CP', color: '#451A03', bg: '#FCD34D' },
  { name: 'Other',     short: 'OT', color: '#1F2937', bg: '#D1D5DB' },
] as const;

const PLATFORMS  = ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'Twitter/X', 'WhatsApp', 'Website', 'Email', 'Other'];
const ALL_STATUSES: ContentStatus[] = ['Not Started', 'Planned', 'Shot', 'Edited', 'Approved', 'Posted'];
const COMPLETED   = new Set<ContentStatus>(['Approved', 'Posted']);
const WEEKDAYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_CLS: Record<ContentStatus, string> = {
  'Not Started': 'bg-gray-100 text-gray-500 ring-gray-200',
  'Planned':     'bg-blue-100 text-blue-600 ring-blue-200',
  'Shot':        'bg-violet-100 text-violet-600 ring-violet-200',
  'Edited':      'bg-amber-100 text-amber-600 ring-amber-200',
  'Approved':    'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'Posted':      'bg-green-100 text-green-800 ring-green-200',
};

const STATUS_DOT: Record<ContentStatus, string> = {
  'Not Started': 'bg-gray-400',
  'Planned':     'bg-blue-500',
  'Shot':        'bg-violet-500',
  'Edited':      'bg-amber-500',
  'Approved':    'bg-emerald-500',
  'Posted':      'bg-green-600',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getType(name: string) {
  return TYPE_CONFIG.find(t => t.name === name) ?? {
    name,
    short: name.slice(0, 2).toUpperCase() || 'OT',
    color: '#4B5563',
    bg: '#F3F4F6',
  };
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function buildCalDays(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1);
  const last  = new Date(year, month, 0);
  const days: Date[] = [];
  for (let i = first.getDay() - 1; i >= 0; i--)
    days.push(new Date(year, month - 1, -i));
  for (let d = 1; d <= last.getDate(); d++)
    days.push(new Date(year, month - 1, d));
  const pad = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= pad; i++)
    days.push(new Date(year, month, i));
  return days;
}

// ── Tiny primitives ────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: ContentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ring-1 ${STATUS_CLS[status]}`}>
      {COMPLETED.has(status) ? '✓' : '○'} {status}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-[#2E3093] animate-spin" />
    </div>
  );
}

// ── Shared modal primitives (defined at module level to avoid remount on re-render) ──
const MODAL_INPUT_CLS = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]/40 bg-white';

function PlatformCheckboxSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (p: string) =>
    onChange(value.includes(p) ? value.filter(x => x !== p) : [...value, p]);

  const label = value.length === 0 ? '— Select —' : value.length === 1 ? value[0] : `${value.length} platforms`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${MODAL_INPUT_CLS} flex items-center justify-between gap-2 text-left`}
      >
        <span className={value.length === 0 ? 'text-gray-400' : 'text-gray-800'}>{label}</span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          {PLATFORMS.map(p => (
            <label key={p} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={value.includes(p)}
                onChange={() => toggle(p)}
                className="rounded accent-[#2E3093] w-3.5 h-3.5"
              />
              {p}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────────
function ItemModal({
  initial,
  saving,
  campaigns,
  onSave,
  onClose,
}: {
  initial: FormItem;
  saving: boolean;
  campaigns: MetaCampaignOption[];
  onSave: (f: FormItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormItem>({
    ...initial,
    platforms: (initial.platform ?? '').split(',').map(s => s.trim()).filter(Boolean),
  });
  const set = <K extends keyof FormItem>(k: K, v: FormItem[K]) =>
    setForm(p => ({ ...p, [k]: v }));
  const typeMeta = getType((form.content_type ?? '').trim() || 'Other');
  const selectedStatus = form.status ?? 'Not Started';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 text-sm">
              {form.id ? 'Edit Content Item' : 'New Content Item'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset"
                style={{ background: typeMeta.bg, color: typeMeta.color, borderColor: `${typeMeta.color}33` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: typeMeta.color }} />
                {typeMeta.name}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ring-1 ${STATUS_CLS[selectedStatus]}`}>
                {COMPLETED.has(selectedStatus) ? '✓' : '○'} {selectedStatus}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Content Type">
              <input
                type="text"
                value={form.content_type ?? ''}
                onChange={e => set('content_type', e.target.value)}
                placeholder="e.g. Reel, Story, Post"
                className={MODAL_INPUT_CLS}
              />
            </ModalField>

            <ModalField label="Status">
              <select
                value={selectedStatus}
                onChange={e => set('status', e.target.value as ContentStatus)}
                className={`${MODAL_INPUT_CLS} ${STATUS_CLS[selectedStatus]} ring-1 border-transparent`}
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>

            <ModalField label="Planned Date">
              <input type="date" value={form.planned_date?.slice(0,10) ?? ''} onChange={e => set('planned_date', e.target.value || null)} className={MODAL_INPUT_CLS} />
            </ModalField>

            <ModalField label="Execution Date">
              <input type="date" value={form.execution_date?.slice(0,10) ?? ''} onChange={e => set('execution_date', e.target.value || null)} className={MODAL_INPUT_CLS} />
            </ModalField>

            <ModalField label="Upload Date">
              <input type="date" value={form.upload_date?.slice(0,10) ?? ''} onChange={e => set('upload_date', e.target.value || null)} className={MODAL_INPUT_CLS} />
            </ModalField>

            <ModalField label="Platform">
              <PlatformCheckboxSelect
                value={form.platforms ?? []}
                onChange={v => set('platforms', v)}
              />
            </ModalField>
          </div>

          <ModalField label="Responsible Person">
            <input type="text" value={form.responsible_person ?? ''} onChange={e => set('responsible_person', e.target.value)} placeholder="Name" className={MODAL_INPUT_CLS} />
          </ModalField>

          <ModalField label="Description">
            <textarea
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe the content..."
              rows={3}
              className={`${MODAL_INPUT_CLS} resize-none`}
            />
          </ModalField>

          {/* Meta Campaign Attribution */}
          <ModalField label="Meta Campaign">
            <select
              value={form.meta_campaign_id ?? ''}
              onChange={e => {
                const selected = campaigns.find(c => c.id === e.target.value);
                set('meta_campaign_id', e.target.value || null);
                set('meta_campaign_name', selected?.name ?? null);
              }}
              className={MODAL_INPUT_CLS}
            >
              <option value="">— Not linked to a Meta campaign —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.leads ? ` · ${c.leads} leads` : ''}
                </option>
              ))}
            </select>
          </ModalField>

          {/* Show performance metrics when a campaign is linked */}
          {form.meta_campaign_id && (() => {
            const perf = campaigns.find(c => c.id === form.meta_campaign_id);
            if (!perf) return null;
            return (
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2E3093]/15 bg-[#2E3093]/5 px-3 py-2.5">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#2E3093]/60">Leads</p>
                  <p className="text-sm font-bold text-[#2E3093]">{perf.leads}</p>
                </div>
                <div className="text-center border-x border-[#2E3093]/15">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#2E3093]/60">Spend</p>
                  <p className="text-sm font-bold text-slate-700">₹{perf.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#2E3093]/60">Cost/Lead</p>
                  <p className="text-sm font-bold text-slate-700">{perf.cpl != null ? `₹${perf.cpl.toFixed(0)}` : '—'}</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, platform: (form.platforms ?? []).join(', ') })}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#2E3093] rounded-lg hover:bg-[#252870] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────────
export default function ContentCalendarWidget() {
  const todayDate = new Date();
  const todayISO  = toISO(todayDate);

  const [view, setView]           = useState<ViewMode>('calendar');
  const [year, setYear]           = useState(todayDate.getFullYear());
  const [month, setMonth]         = useState(todayDate.getMonth() + 1);
  const [items, setItems]         = useState<ContentItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<FormItem | null>(null);
  const [saving, setSaving]       = useState(false);
  const [plan, setPlan]           = useState<ContentPlanRow[]>([]);
  const planLoaded                = useRef(false);
  const [trackerSort, setTrackerSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [campaigns, setCampaigns] = useState<MetaCampaignOption[]>([]);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cbd-content-calendar?year=${y}&month=${m}`, { cache: 'no-store' });
      if (res.ok) setItems((await res.json()).rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year, month); }, [load, year, month]);

  useEffect(() => {
    if (planLoaded.current) return;
    planLoaded.current = true;
    fetch('/api/cbd-content-plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setPlan(d.rows ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/meta-ads/performance', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(d => {
        const opts: MetaCampaignOption[] = (d.campaigns ?? [])
          .filter((c: { campaignId?: string | null }) => c.campaignId)
          .map((c: { campaignId: string; campaignName?: string | null; leads?: number; spend?: number; costPerLead?: number | null }) => ({
            id: c.campaignId,
            name: c.campaignName || c.campaignId,
            leads: c.leads ?? 0,
            spend: c.spend ?? 0,
            cpl: c.costPerLead ?? null,
          }));
        setCampaigns(opts);
      })
      .catch(() => {});
  }, []);

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };
  const goToday   = () => { setYear(todayDate.getFullYear()); setMonth(todayDate.getMonth()+1); };

  const handleSave = async (form: FormItem) => {
    setSaving(true);
    try {
      if (form.id) {
        await fetch(`/api/cbd-content-calendar/${form.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/cbd-content-calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
      }
      setModal(null);
      await load(year, month);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/cbd-content-calendar/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleInlineStatus = async (item: ContentItem, status: ContentStatus) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status } : i));
    await fetch(`/api/cbd-content-calendar/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, status }),
    });
  };

  // Calendar: group items by planned_date
  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of items) {
      if (!item.planned_date) continue;
      const k = item.planned_date.slice(0,10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    return map;
  }, [items]);

  const calDays = useMemo(() => buildCalDays(year, month), [year, month]);

  const frequencyStats = useMemo(() => {
    const countByType = new Map<string, { planned: number; completed: number }>();
    for (const item of items) {
      const key = (item.content_type ?? '').trim().toLowerCase();
      const prev = countByType.get(key) ?? { planned: 0, completed: 0 };
      prev.planned += 1;
      if (COMPLETED.has(item.status)) prev.completed += 1;
      countByType.set(key, prev);
    }
    return plan.map(row => {
      const key = row.content_type.trim().toLowerCase();
      const counts = countByType.get(key) ?? { planned: 0, completed: 0 };
      return { ...row, planned: counts.planned, completed: counts.completed };
    });
  }, [plan, items]);

  const sortedFrequencyStats = useMemo(() => {
    if (!trackerSort) return frequencyStats;
    return [...frequencyStats].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (trackerSort.col) {
        case 'content_type':  va = a.content_type.toLowerCase();               vb = b.content_type.toLowerCase();               break;
        case 'frequency':     va = (a.frequency ?? '').toLowerCase();          vb = (b.frequency ?? '').toLowerCase();          break;
        case 'responsible':   va = (a.responsible_person ?? '').toLowerCase(); vb = (b.responsible_person ?? '').toLowerCase(); break;
        case 'target':        va = a.target_per_month;                         vb = b.target_per_month;                         break;
        case 'planned':       va = a.planned;                                  vb = b.planned;                                  break;
        case 'completed':     va = a.completed;                                vb = b.completed;                                break;
        default:              return 0;
      }
      if (va < vb) return trackerSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return trackerSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [frequencyStats, trackerSort]);

  const cycleSort = (col: string) => {
    setTrackerSort(prev => {
      if (!prev || prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return null;
    });
  };

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = () => {
    const SortBtn = ({ col, label, cls = '' }: { col: string; label: React.ReactNode; cls?: string }) => {
      const active = trackerSort?.col === col;
      const dir    = active ? trackerSort!.dir : null;
      return (
        <th
          onClick={() => cycleSort(col)}
          className={`cursor-pointer select-none group ${cls}`}
          title={`Sort by ${col}`}
        >
          <span className="inline-flex items-center gap-0.5">
            {label}
            <span className="inline-flex flex-col gap-[1px] ml-0.5">
              <svg className={`w-2 h-2 ${active && dir === 'asc' ? 'text-white' : 'text-white/30 group-hover:text-white/60'}`} fill="currentColor" viewBox="0 0 8 4"><path d="M4 0L8 4H0z"/></svg>
              <svg className={`w-2 h-2 ${active && dir === 'desc' ? 'text-white' : 'text-white/30 group-hover:text-white/60'}`} fill="currentColor" viewBox="0 0 8 4"><path d="M4 4L0 0H8z"/></svg>
            </span>
          </span>
        </th>
      );
    };

    return (
      <aside className="absolute inset-y-0 left-0 w-[420px] flex flex-col border-r border-gray-200 bg-gray-50/60 overflow-hidden z-10">
        {/* Tracker header row with refresh button */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-[#2E3093]/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#2E3093]">Content Tracker</span>
          <button
            onClick={() => setTrackerSort(null)}
            title="Reset sort"
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-[#2E3093] transition-colors px-1.5 py-0.5 rounded hover:bg-white"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 z-10">
              {frequencyStats.length > 0 && (
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <td className="px-2 py-1.5 text-[11px] font-bold text-gray-700 border-r border-gray-200">Total</td>
                  <td className="px-2 py-1.5 border-r border-gray-200" />
                  <td className="px-2 py-1.5 border-r border-gray-200" />
                  <td className="px-1 py-1.5 text-center tabular-nums font-bold text-gray-600 border-r border-gray-200">
                    {frequencyStats.reduce((s, r) => s + r.target_per_month, 0) || '—'}
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums font-bold text-blue-700 border-r border-gray-200">
                    {items.length || '—'}
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums font-bold text-emerald-700">
                    {items.filter(i => COMPLETED.has(i.status)).length || '—'}
                  </td>
                </tr>
              )}
              <tr className="bg-[#2E3093]">
                <SortBtn col="content_type" label="Content Type"   cls="text-left px-2 py-2 font-semibold text-white uppercase tracking-wide border-r border-white/20 leading-tight" />
                <SortBtn col="frequency"    label="Frequency"      cls="text-left px-2 py-2 font-semibold text-white/80 uppercase tracking-wide border-r border-white/20 w-[90px] leading-tight" />
                <SortBtn col="responsible"  label="Responsible"    cls="text-left px-2 py-2 font-semibold text-white/80 uppercase tracking-wide border-r border-white/20 w-[72px] leading-tight" />
                <SortBtn col="target"       label="Tgt"            cls="text-center px-1 py-2 font-semibold text-white/80 uppercase tracking-wide border-r border-white/20 w-8 leading-tight" />
                <SortBtn col="planned"      label="Pln"            cls="text-center px-1 py-2 font-semibold text-blue-200 uppercase tracking-wide border-r border-white/20 w-8 leading-tight" />
                <SortBtn col="completed"    label="Done"           cls="text-center px-1 py-2 font-semibold text-emerald-300 uppercase tracking-wide w-9 leading-tight" />
              </tr>
            </thead>
            <tbody>
              {frequencyStats.length === 0
                ? Array.from({length: 5}).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({length: 6}).map((_, j) => (
                        <td key={j} className="px-2 py-2 border-r border-gray-100 last:border-r-0">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : sortedFrequencyStats.map((row, i) => {
                    const hasTarget = row.target_per_month > 0;
                    const met = hasTarget && row.completed >= row.target_per_month;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-gray-200 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}
                      >
                        <td className="px-2 py-1.5 text-[11px] font-semibold text-gray-800 leading-snug border-r border-gray-200">
                          {row.content_type}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 border-r border-gray-200 max-w-[90px]">
                          <span className="block truncate" title={row.frequency}>{row.frequency}</span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-500 border-r border-gray-200 max-w-[72px]">
                          <span className="block truncate" title={row.responsible_person}>{row.responsible_person || '—'}</span>
                        </td>
                        <td className="px-1 py-1.5 text-center tabular-nums text-gray-500 border-r border-gray-200">
                          {hasTarget ? row.target_per_month : '—'}
                        </td>
                        <td className="px-1 py-1.5 text-center tabular-nums text-blue-600 font-semibold border-r border-gray-200">
                          {row.planned || '—'}
                        </td>
                        <td className={`px-1 py-1.5 text-center tabular-nums font-semibold ${met ? 'text-emerald-700' : row.completed > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                          {row.completed || '—'}{met ? ' ✓' : ''}
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </aside>
    );
  };

  // ── Calendar View ────────────────────────────────────────────────────────────
  const CalendarView = () => {
    const total = items.length;
    const done = items.filter(i => COMPLETED.has(i.status)).length;
    const active = total - done;

    return (
      <div className="flex-1 min-w-0 bg-[#FBFBFD] p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Posts</p>
            <p className="text-lg font-semibold tabular-nums text-gray-800 leading-tight">{total}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Completed</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-700 leading-tight">{done}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Active</p>
            <p className="text-lg font-semibold tabular-nums text-blue-700 leading-tight">{active}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 px-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-1 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-7 gap-2">
            {calDays.map((day, idx) => {
              const iso      = toISO(day);
              const isCurMo  = day.getMonth() + 1 === month;
              const isToday  = iso === todayISO;
              const dayItems = byDate.get(iso) ?? [];
              const cardType = dayItems.length > 0 ? getType(dayItems[0].content_type) : null;
              const doneCount = dayItems.filter(i => COMPLETED.has(i.status)).length;
              const progress = dayItems.length ? Math.round((doneCount / dayItems.length) * 100) : 0;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!isCurMo) return;
                    if (dayItems.length > 0) {
                      setModal({ ...dayItems[0] });
                      return;
                    }
                    setModal({ planned_date: iso, status: 'Not Started', content_type: 'Post' });
                  }}
                  className={[
                    'min-h-[72px] rounded-xl border p-1.5 text-left transition-all',
                    isCurMo
                      ? dayItems.length > 0
                        ? 'hover:shadow-md'
                        : 'bg-white border-gray-300 hover:border-gray-400 hover:shadow-sm'
                      : 'bg-gray-100 border-gray-300',
                    isToday ? 'ring-2 ring-[#2E3093]/15 border-[#2E3093]/35' : '',
                  ].join(' ')}
                  style={
                    isCurMo && dayItems.length > 0 && cardType
                      ? {
                          background: `linear-gradient(180deg, ${cardType.bg} 0%, ${cardType.bg}CC 100%)`,
                          borderColor: `${cardType.color}55`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={[
                      'text-[11px] font-semibold tabular-nums inline-flex items-center justify-center w-6 h-6 rounded-full',
                      isToday  ? 'bg-[#2E3093] text-white' :
                      isCurMo  ? 'text-gray-700 bg-gray-100' : 'text-gray-300 bg-gray-100',
                    ].join(' ')}>
                      {day.getDate()}
                    </span>
                    {isToday && <span className="text-[9px] font-semibold text-[#2E3093]">Today</span>}
                    {!isToday && dayItems.length > 0 && (
                      <span className="text-[10px] font-semibold tabular-nums text-gray-500">{dayItems.length}</span>
                    )}
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="h-[36px] rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
                      {isCurMo ? 'No posts' : '—'}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {dayItems.slice(0, 2).map(item => {
                        const tc = getType(item.content_type);
                        return (
                          <div
                            key={item.id}
                            onClick={e => { e.stopPropagation(); setModal({ ...item }); }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold truncate"
                            style={{ background: tc.bg, color: tc.color }}
                            title={`${item.content_type}${item.description ? ' · ' + item.description : ''} (${item.status})${item.meta_campaign_name ? ' · Meta: ' + item.meta_campaign_name : ''}`}
                          >
                            <span className="inline-flex items-center justify-center min-w-5 h-4 px-1 rounded text-[8px] font-bold tracking-wide bg-white/70">
                              {tc.short}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />
                            <span className="truncate flex-1">{item.content_type}</span>
                            {item.meta_campaign_id && (
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/80 shrink-0" title={`Meta: ${item.meta_campaign_name}`}>
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                                </svg>
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {dayItems.length > 2 && (
                        <p className="text-[10px] text-gray-500 px-1">+{dayItems.length - 2} more</p>
                      )}

                      <div className="pt-1">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-[9px] text-gray-500 mt-1 tabular-nums">{doneCount}/{dayItems.length} completed</p>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Meta Attribution panel */}
        {(() => {
          const linked = items.filter(i => i.meta_campaign_id);
          if (linked.length === 0) return null;
          // Group by campaign
          const byCampaign = new Map<string, { name: string; items: ContentItem[]; perf: MetaCampaignOption | undefined }>();
          for (const item of linked) {
            const cid = item.meta_campaign_id!;
            if (!byCampaign.has(cid)) {
              byCampaign.set(cid, { name: item.meta_campaign_name || cid, items: [], perf: campaigns.find(c => c.id === cid) });
            }
            byCampaign.get(cid)!.items.push(item);
          }
          return (
            <div className="mt-4 mx-3 mb-3 rounded-xl border border-[#2E3093]/15 overflow-hidden">
              <div className="px-4 py-2.5 bg-[#2E3093]/5 border-b border-[#2E3093]/10 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2E3093]">Meta Campaign Attribution</span>
                <span className="ml-auto text-[10px] text-[#2E3093]/60">{linked.length} item{linked.length !== 1 ? 's' : ''} linked</span>
              </div>
              <div className="divide-y divide-[#2E3093]/8">
                {Array.from(byCampaign.entries()).map(([cid, { name, items: citems, perf }]) => {
                  const posted = citems.filter(i => COMPLETED.has(i.status)).length;
                  return (
                    <div key={cid} className="px-4 py-3 flex items-center gap-4 flex-wrap bg-white hover:bg-[#2E3093]/3 transition-colors">
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-[11px] font-semibold text-slate-800 truncate max-w-[220px]" title={name}>{name}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {citems.map(i => {
                            const tc = getType(i.content_type);
                            return (
                              <span key={i.id}
                                onClick={() => setModal({ ...i })}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer hover:opacity-80"
                                style={{ background: tc.bg, color: tc.color }}
                              >
                                <span className={`w-1 h-1 rounded-full ${STATUS_DOT[i.status]}`} />
                                {i.content_type}
                                {i.planned_date && <span className="opacity-60">{fmtDate(i.planned_date)}</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-4 shrink-0 text-center">
                        <div>
                          <p className="text-[9px] font-bold uppercase text-gray-400">Content</p>
                          <p className="text-sm font-bold text-slate-700">{citems.length}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase text-gray-400">Posted</p>
                          <p className={`text-sm font-bold ${posted === citems.length ? 'text-emerald-600' : 'text-slate-700'}`}>{posted}</p>
                        </div>
                        {perf && (
                          <>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-gray-400">Leads</p>
                              <p className="text-sm font-bold text-[#2E3093]">{perf.leads}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-gray-400">Spend</p>
                              <p className="text-sm font-bold text-slate-700">₹{perf.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-gray-400">CPL</p>
                              <p className="text-sm font-bold text-slate-700">{perf.cpl != null ? `₹${perf.cpl.toFixed(0)}` : '—'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Planner / Excel View ─────────────────────────────────────────────────────
  const PlannerView = () => (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
          <tr>
            {['#','Content Type','Planned','Execution','Status','Upload','Platform','Responsible','Meta Campaign','Description',''].map((h, i) => (
              <th key={i} className={`py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${i === 0 || i === 10 ? 'text-center w-10' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({length: 5}).map((_, i) => (
              <tr key={i} className="border-t border-gray-100">
                {Array.from({length: 11}).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j === 9 ? '80%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-5 py-14 text-center text-sm text-gray-400">
                No content planned for {MONTH_NAMES[month-1]} {year}
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const tc = getType(item.content_type);
              const perf = item.meta_campaign_id ? campaigns.find(c => c.id === item.meta_campaign_id) : null;
              return (
                <tr key={item.id} className={`border-t border-gray-100 hover:bg-gray-50/60 transition-colors ${COMPLETED.has(item.status) ? 'opacity-70' : ''}`}>
                  <td className="px-3 py-2.5 text-center text-[11px] text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5" style={{ background: tc.bg, color: tc.color }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tc.color }} />
                      {item.content_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600 whitespace-nowrap">{fmtDate(item.planned_date)}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600 whitespace-nowrap">{fmtDate(item.execution_date)}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={item.status}
                      onChange={e => handleInlineStatus(item, e.target.value as ContentStatus)}
                      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border-0 ring-1 outline-none cursor-pointer ${STATUS_CLS[item.status]}`}
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{COMPLETED.has(s) ? '✓' : '○'} {s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600 whitespace-nowrap">{fmtDate(item.upload_date)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{item.platform || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[96px] truncate">{item.responsible_person || '—'}</td>
                  <td className="px-3 py-2.5 max-w-[150px]">
                    {item.meta_campaign_id ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-[#2E3093] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                          </svg>
                          <span className="text-[11px] font-semibold text-[#2E3093] truncate max-w-[110px]" title={item.meta_campaign_name ?? ''}>
                            {item.meta_campaign_name || item.meta_campaign_id}
                          </span>
                        </div>
                        {perf && (
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[9px] text-emerald-600 font-semibold">{perf.leads} leads</span>
                            {perf.cpl != null && <span className="text-[9px] text-slate-400">₹{perf.cpl.toFixed(0)}/lead</span>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">{item.description || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setModal({ ...item })} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="font-bold text-gray-800 text-sm flex-1">Content Calendar</span>

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[128px] text-center select-none">
            {MONTH_NAMES[month-1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={goToday} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ml-0.5">
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 text-[11px] font-semibold">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 transition-colors ${view === 'calendar' ? 'bg-white text-[#2E3093] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('planner')}
            className={`px-3 py-1.5 transition-colors ${view === 'planner' ? 'bg-white text-[#2E3093] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Planner
          </button>
        </div>

        {/* Add */}
        <button
          onClick={() => setModal({ status: 'Not Started', content_type: 'Post' })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#252870] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* ── Body ── */}
      <div className="relative">
        <Sidebar />
        <div className="ml-[420px]">
          {view === 'calendar' ? <CalendarView /> : <PlannerView />}
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <ItemModal
          initial={modal}
          saving={saving}
          campaigns={campaigns}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
