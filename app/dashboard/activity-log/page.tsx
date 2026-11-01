'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type LogRow = {
  id: number;
  table_name: string;
  action_type: string;
  record_id: string | null;
  user_id: number | null;
  user_name: string | null;
  endpoint: string | null;
  created_at: string;
  details: unknown;
};

type LogData = {
  rows: LogRow[];
  total: number;
  accountsActive: number;
  failedLogins: number;
  deletes: number;
  accounts: { id: number; name: string | null; count: number }[];
  actions: string[];
  latest: number;
  pageSize: number;
};

const POLL_MS = 15000;

type OnlineUser = {
  user_id: number;
  user_name: string | null;
  page: string | null;
  last_click: string | null;
  last_click_at: string | null;
};


const ACTION_LABELS: Record<string, string> = {
  VIEW: 'Viewed',
  PAGE: 'Opened page',
  CLICK: 'Clicked',
  CREATE: 'Added',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  RESTORE: 'Restored',
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  REQUEST: 'Submitted',
  LOGIN_FAILED: 'Failed sign-in',
};

const ACTION_HELP: [string, string][] = [
  ['Added', 'Created something new'],
  ['Changed', 'Edited something that already existed'],
  ['Deleted', 'Removed something'],
  ['Opened page', 'Went to a screen in the software'],
  ['Clicked', 'Pressed a button or link'],
  ['Viewed', 'Opened or looked at something'],
  ['Submitted', 'Sent a form or button action. It may not have saved, so check the item if it matters'],
  ['Failed sign-in', 'Someone tried to sign in and it was refused'],
];

const MODULE_LABELS: Record<string, string> = {
  student_inquiry: 'an inquiry',
  consultant_follows: 'a consultant follow-up',
  consultant_mst: 'a consultant',
  inquiry_contact_log: 'an inquiry contact record',
  deputation_entries: 'a deputation entry',
  support_tickets: 'a support ticket',
  role: 'a role',
  role_permissions: 'role permissions',
  corporate_inquiry: 'a corporate inquiry',
};

const VERBS: Record<string, string> = {
  VIEW: 'viewed', CREATE: 'added', UPDATE: 'changed', DELETE: 'deleted', RESTORE: 'restored',
};

/** "inquiry/discussions" or "Student_Inquiry" become words a reader recognises. */
function moduleName(raw: string) {
  const known = MODULE_LABELS[raw.toLowerCase()];
  if (known) return known;
  return raw.split('/').map((part) => part.replace(/[-_]+/g, ' ')).join(' > ');
}

function pageName(path: string | null) {
  const name = (path ?? '').replace(/^\/dashboard\/?/, '').split('/').filter((p) => p && !/^\d+$/.test(p)).join(' > ').replace(/[-_]+/g, ' ');
  return name || 'home dashboard';
}

function describe(r: LogRow) {
  const who = r.user_name || (r.user_id ? `User ${r.user_id}` : 'Someone');
  const what = moduleName(r.table_name);
  const record = r.record_id ? ` (no. ${r.record_id})` : '';
  if (r.action_type === 'PAGE') return `${who} opened ${pageName(r.endpoint)}`;
  if (r.action_type === 'CLICK') {
    const label = (r.details as { clicked?: string } | null)?.clicked;
    return `${who} clicked "${label ?? 'a button'}" on ${pageName(r.endpoint)}`;
  }
  if (r.action_type === 'LOGIN') return `${who} signed in`;
  if (r.action_type === 'LOGOUT') return `${who} signed out`;
  if (r.action_type === 'LOGIN_FAILED') return `Failed sign-in attempt using the username "${who}"`;
  if (r.action_type === 'REQUEST') return `${who} submitted an action in ${what}${record}`;
  return `${who} ${VERBS[r.action_type] ?? r.action_type.toLowerCase()} ${what}${record}`;
}

function detailLines(details: unknown): [string, string][] {
  if (details == null) return [];
  if (typeof details !== 'object') return [['Note', String(details)]];
  return Object.entries(details as Record<string, unknown>)
    .filter(([key, value]) => key !== 'method' && value != null && value !== '')
    .map(([key, value]) => [
      key.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    ]);
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN_FAILED: 'bg-red-50 text-red-700 border-red-200',
  RESTORE: 'bg-amber-50 text-amber-700 border-amber-200',
  LOGIN: 'bg-violet-50 text-violet-700 border-violet-200',
  LOGOUT: 'bg-violet-50 text-violet-700 border-violet-200',
};

const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.charAt(0) + a.slice(1).toLowerCase();
const indiaDay = (daysAgo = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
  .format(new Date(Date.now() - daysAgo * 86_400_000));
const indiaToday = () => indiaDay();

function formatTime(raw: string) {
  const d = new Date(raw.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function ActivityLogPage() {
  const { isSuperAdmin, loading: permLoading } = usePermissions();
  const [from, setFrom] = useState(indiaToday);
  const [to, setTo] = useState(indiaToday);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogData | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const latest = useRef(0);
  const [online, setOnline] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const refresh = async () => {
      if (document.hidden) return;
      const res = await fetch('/api/activity-log?live=1', { cache: 'no-store' }).catch(() => null);
      if (res?.ok) setOnline((await res.json()).online);
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [isSuperAdmin]);

  const query = useCallback(() => {
    const p = new URLSearchParams({ from, to, sort, page: String(page) });
    if (userId) p.set('userId', userId);
    if (action) p.set('action', action);
    if (q.trim()) p.set('q', q.trim());
    return p;
  }, [from, to, sort, page, userId, action, q]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity-log?${query()}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load');
      setData(body);
      latest.current = body.latest;
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [query]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [isSuperAdmin, load]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const p = query();
        p.set('latest', '1');
        const res = await fetch(`/api/activity-log?${p}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (body.latest !== latest.current) await load();
        else setUpdatedAt(new Date());
      } catch {
        // The next tick retries.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [isSuperAdmin, load, query]);

  if (permLoading) return <PermissionLoading />;
  if (!isSuperAdmin) return <AccessDenied />;

  const applyFilter = (fn: () => void) => { fn(); setPage(1); setExpanded(null); };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const inputCls = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white';
  const tiles = [
    ['Total activities', data?.total ?? 0],
    ['People active', data?.accountsActive ?? 0],
    ['Items deleted', data?.deletes ?? 0],
    ['Failed sign-ins', data?.failedLogins ?? 0],
  ] as const;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Activity Log</h1>
          <p className="text-sm text-slate-500">See who did what in the software, and when. Click any row for more.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live{updatedAt ? ` · checked ${updatedAt.toLocaleTimeString('en-IN')}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-slate-800">{value.toLocaleString('en-IN')}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-800 mb-2">Online now ({online.length})</div>
        {online.length === 0 && <div className="text-sm text-slate-400">Nobody is active right now.</div>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
          {online.map((u) => (
            <div key={u.user_id} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <div className="font-semibold text-slate-800">{u.user_name || `User ${u.user_id}`}</div>
              <div className="text-xs text-slate-600">On {pageName(u.page)}</div>
              <div className="text-xs text-slate-500">
                {u.last_click ? `Last clicked "${u.last_click}"${u.last_click_at ? ` at ${formatTime(u.last_click_at)}` : ''}` : 'No clicks yet'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['Today', 0, 0], ['Yesterday', 1, 1], ['Last 7 days', 6, 0], ['Last 30 days', 29, 0]] as const).map(([label, start, end]) => {
          const active = from === indiaDay(start) && to === indiaDay(end);
          return (
            <button
              key={label}
              onClick={() => applyFilter(() => { setFrom(indiaDay(start)); setTo(indiaDay(end)); })}
              className={`px-3 py-1.5 rounded-lg border text-sm ${active ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <label className="text-xs text-slate-600">From
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && applyFilter(() => setFrom(e.target.value))} className={`block mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-slate-600">To
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && applyFilter(() => setTo(e.target.value))} className={`block mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-slate-600">Person
          <select value={userId} onChange={(e) => applyFilter(() => setUserId(e.target.value))} className={`block mt-1 ${inputCls}`}>
            <option value="">Everyone</option>
            {data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name || `User ${a.id}`} ({a.count})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Action
          <select value={action} onChange={(e) => applyFilter(() => setAction(e.target.value))} className={`block mt-1 ${inputCls}`}>
            <option value="">All actions</option>
            {data?.actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Sort
          <select value={sort} onChange={(e) => applyFilter(() => setSort(e.target.value as 'newest' | 'oldest'))} className={`block mt-1 ${inputCls}`}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <label className="text-xs text-slate-600 flex-1 min-w-48">Search
          <input value={q} onChange={(e) => applyFilter(() => setQ(e.target.value))} placeholder="Name, topic or number" className={`block w-full mt-1 ${inputCls}`} />
        </label>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2">Date &amp; time</th>
              <th className="px-4 py-2">What happened</th>
              <th className="px-4 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">{formatTime(r.created_at)}</td>
                  <td className="px-4 py-2 text-slate-800">{describe(r)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${ACTION_STYLES[r.action_type] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {actionLabel(r.action_type)}
                    </span>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 text-xs text-slate-600 space-y-1">
                      {detailLines(r.details).map(([label, value]) => (
                        <div key={label} className="break-words"><span className="font-semibold">{label}:</span> {value}</div>
                      ))}
                      {detailLines(r.details).length === 0 && <div>No further details were recorded.</div>}
                      <div className="text-slate-400">Reference for support: {r.endpoint ?? 'none'}</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data?.rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nothing found for these dates and filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-800 mb-2">What the types mean</div>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
          {ACTION_HELP.map(([label, help]) => <div key={label}><span className="font-semibold">{label}:</span> {help}</div>)}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-40">Previous</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
