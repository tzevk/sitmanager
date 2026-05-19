'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
type ContentStatus = 'Not Started' | 'Planned' | 'Shot' | 'Edited' | 'Approved' | 'Posted';
type ViewMode = 'calendar' | 'planner';

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
}

type FormItem = Partial<ContentItem>;

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG = [
  { name: 'Reel',      short: 'RL', color: '#7C3AED', bg: '#F3E8FF' },
  { name: 'Story',     short: 'ST', color: '#2563EB', bg: '#DBEAFE' },
  { name: 'Post',      short: 'PO', color: '#059669', bg: '#D1FAE5' },
  { name: 'Video',     short: 'VD', color: '#EA580C', bg: '#FFEDD5' },
  { name: 'Carousel',  short: 'CR', color: '#DB2777', bg: '#FCE7F3' },
  { name: 'Blog',      short: 'BL', color: '#0F766E', bg: '#CCFBF1' },
  { name: 'Campaign',  short: 'CP', color: '#D97706', bg: '#FEF3C7' },
  { name: 'Other',     short: 'OT', color: '#4B5563', bg: '#F3F4F6' },
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
  onSave,
  onClose,
}: {
  initial: FormItem;
  saving: boolean;
  onSave: (f: FormItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormItem>(initial);
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
              <select value={form.platform ?? ''} onChange={e => set('platform', e.target.value)} className={MODAL_INPUT_CLS}>
                <option value="">— Select —</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
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

  // Sidebar: per-type stats derived from current planner data (supports manual types)
  const typeStats = useMemo(() => {
    const map = new Map<string, { name: string; short: string; color: string; bg: string; planned: number; done: number; pending: number }>();

    for (const item of items) {
      const rawName = (item.content_type ?? '').trim() || 'Other';
      const key = rawName.toLowerCase();
      const type = getType(rawName);
      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          name: rawName,
          short: type.short,
          color: type.color,
          bg: type.bg,
          planned: 1,
          done: COMPLETED.has(item.status) ? 1 : 0,
          pending: COMPLETED.has(item.status) ? 0 : 1,
        });
      } else {
        prev.planned += 1;
        if (COMPLETED.has(item.status)) prev.done += 1;
        else prev.pending += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.planned - a.planned || a.name.localeCompare(b.name));
  }, [items]);

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

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/60 flex flex-col self-stretch">
      <div className="px-3 pt-4 pb-2 h-full overflow-y-auto">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Content Types</p>

        {/* Column labels */}
        <div className="flex items-center gap-1 px-1 mb-1">
          <span className="flex-1 text-[9px] text-gray-400">Type</span>
          <span className="w-7 text-center text-[9px] text-gray-400">Plan</span>
          <span className="w-7 text-center text-[9px] text-emerald-500">Done</span>
          <span className="w-7 text-center text-[9px] text-amber-500">Pend</span>
        </div>

        {loading
          ? Array.from({length: 5}).map((_, i) => (
              <div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse mb-1" />
            ))
          : typeStats.map(s => {
              return (
                <div key={s.name.toLowerCase()} className="flex items-center gap-1.5 px-1 py-1.5 rounded-lg hover:bg-white transition-colors">
                  <span
                    className="w-7 h-5 rounded-md text-[9px] font-bold tracking-wide inline-flex items-center justify-center shrink-0"
                    style={{ background: s.bg, color: s.color }}
                    title={s.name}
                  >
                    {s.short}
                  </span>
                  <span className="flex-1 text-[11px] font-medium text-gray-700 truncate" title={s.name}>{s.name}</span>
                  <span className="w-7 text-center text-[10px] tabular-nums text-gray-500">{s.planned || '—'}</span>
                  <span className="w-7 text-center text-[10px] tabular-nums text-emerald-600 font-semibold">{s.done || '—'}</span>
                  <span className="w-7 text-center text-[10px] tabular-nums text-amber-600 font-semibold">{s.pending || '—'}</span>
                </div>
              );
            })
        }

        {/* Total */}
        {!loading && (
          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-1 px-1">
            <span className="flex-1 text-[10px] font-bold text-gray-600">Total</span>
            <span className="w-7 text-center text-[10px] tabular-nums font-bold text-gray-700">{items.length || '—'}</span>
            <span className="w-7 text-center text-[10px] tabular-nums font-bold text-emerald-600">
              {items.filter(i => COMPLETED.has(i.status)).length || '—'}
            </span>
            <span className="w-7 text-center text-[10px] tabular-nums font-bold text-amber-600">
              {items.filter(i => !COMPLETED.has(i.status)).length || '—'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );

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
                    'min-h-[106px] rounded-2xl border p-1.5 text-left transition-all',
                    isCurMo
                      ? dayItems.length > 0
                        ? 'hover:shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      : 'bg-gray-50/70 border-gray-100',
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
                    <div className="h-[56px] rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
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
                            title={`${item.content_type}${item.description ? ' · ' + item.description : ''} (${item.status})`}
                          >
                            <span className="inline-flex items-center justify-center min-w-5 h-4 px-1 rounded text-[8px] font-bold tracking-wide bg-white/70">
                              {tc.short}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />
                            <span className="truncate">{item.content_type}</span>
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
      </div>
    );
  };

  // ── Planner / Excel View ─────────────────────────────────────────────────────
  const PlannerView = () => (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
          <tr>
            {['#','Content Type','Planned','Execution','Status','Upload','Platform','Responsible','Description',''].map((h, i) => (
              <th key={i} className={`py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${i === 0 || i === 9 ? 'text-center w-10' : i >= 4 && i <= 8 ? 'text-left' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({length: 5}).map((_, i) => (
              <tr key={i} className="border-t border-gray-100">
                {Array.from({length: 10}).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j === 8 ? '80%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-5 py-14 text-center text-sm text-gray-400">
                No content planned for {MONTH_NAMES[month-1]} {year}
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const tc = getType(item.content_type);
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
      <div className="flex">
        <Sidebar />
        {view === 'calendar' ? <CalendarView /> : <PlannerView />}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <ItemModal
          initial={modal}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
