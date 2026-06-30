'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FaPlus, FaSearch, FaLifeRing, FaPaperPlane, FaTimes, FaInbox,
  FaUserShield, FaUser, FaCircle,
} from 'react-icons/fa';
import { usePermissions } from '@/lib/permissions-context';
import { PermissionLoading } from '@/components/ui/PermissionGate';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

interface Ticket {
  id: number;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  message: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  department: string | null;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
}

interface Reply {
  id: number;
  ticket_id: number;
  message: string;
  author_name: string | null;
  is_admin: number;
  created_at: string;
}

interface Stats { open: number; in_progress: number; resolved: number; closed: number; total: number; }

const STATUS_META: Record<TicketStatus, { label: string; dot: string; chip: string }> = {
  open: { label: 'Open', dot: 'text-blue-500', chip: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', dot: 'text-amber-500', chip: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', dot: 'text-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Closed', dot: 'text-slate-400', chip: 'bg-slate-100 text-slate-600' },
};

const PRIORITY_CHIP: Record<TicketPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-100 text-sky-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function fmtDate(s: string | null) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SupportPage() {
  const { loading: sessionLoading } = usePermissions();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ ticket: Ticket; replies: Reply[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchTickets = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await fetch(`/api/support/tickets?${qs.toString()}`, { cache: 'no-store', signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.success) {
        setTickets(data.data || []);
        setStats(data.stats || null);
        setCanManage(Boolean(data.canManage));
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error('Failed to load tickets', e);
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchTickets();
    return () => {
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
    };
  }, [fetchTickets]);

  const openTicket = useCallback(async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setReplyText('');
    try {
      const res = await fetch(`/api/support/tickets/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setDetail(data.data);
        setCanManage(Boolean(data.canManage));
      }
    } catch (e) {
      console.error('Failed to load ticket', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const sendReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${detail.ticket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setReplyText('');
        await openTicket(detail.ticket.id);
        fetchTickets();
      } else {
        alert(data.error || 'Failed to send reply');
      }
    } catch {
      alert('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: TicketStatus) => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/support/tickets/${detail.ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setDetail({ ...detail, ticket: { ...detail.ticket, status } });
        fetchTickets();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch {
      alert('Failed to update status');
    }
  };

  if (sessionLoading) return <PermissionLoading />;

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
            <FaLifeRing className="w-5 h-5 text-[#2E3093]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Support Tickets</h1>
            <p className="text-xs text-slate-400">
              {canManage ? 'All account queries — reply and manage status' : 'Raise a query and track our replies'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors"
        >
          <FaPlus className="w-3.5 h-3.5" /> New Ticket
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {([
            ['all', 'Total', stats.total, 'text-slate-700'],
            ['open', 'Open', stats.open, 'text-blue-600'],
            ['in_progress', 'In Progress', stats.in_progress, 'text-amber-600'],
            ['resolved', 'Resolved', stats.resolved, 'text-emerald-600'],
            ['closed', 'Closed', stats.closed, 'text-slate-500'],
          ] as const).map(([key, label, value, color]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key as TicketStatus | 'all')}
              className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                statusFilter === key ? 'border-[#2E3093] bg-[#2E3093]/5' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── Body: list + detail ── */}
      <div className="flex-1 flex min-h-0">
        {/* List */}
        <div className="w-full md:w-[360px] border-r border-slate-100 flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={canManage ? 'Search subject, account…' : 'Search your tickets…'}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-16"><PermissionLoading /></div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FaInbox className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium">No tickets found</p>
                <p className="text-xs">Click “New Ticket” to raise a query.</p>
              </div>
            ) : (
              tickets.map((t) => {
                const sm = STATUS_META[t.status];
                return (
                  <button
                    key={t.id}
                    onClick={() => openTicket(t.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${
                      selectedId === t.id ? 'bg-[#2E3093]/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 line-clamp-1">{t.subject}</span>
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${sm.chip}`}>{sm.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      {canManage && t.user_name && (
                        <span className="font-medium text-slate-500 truncate max-w-[120px]">{t.user_name}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded ${PRIORITY_CHIP[t.priority]}`}>{t.priority}</span>
                      {t.reply_count > 0 && <span>{t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</span>}
                      <span className="ml-auto">{fmtDate(t.last_reply_at || t.created_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="hidden md:flex flex-1 flex-col min-h-0">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <FaLifeRing className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium text-slate-400">Select a ticket to view the conversation</p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex-1"><PermissionLoading /></div>
          ) : (
            <>
              {/* Detail header */}
              <div className="px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-800">{detail.ticket.subject}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span className={`px-1.5 py-0.5 rounded ${PRIORITY_CHIP[detail.ticket.priority]}`}>{detail.ticket.priority}</span>
                      {detail.ticket.category && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{detail.ticket.category}</span>}
                      <span>#{detail.ticket.id}</span>
                      {canManage && detail.ticket.user_name && (
                        <span className="text-slate-500">· {detail.ticket.user_name}{detail.ticket.department ? ` (${detail.ticket.department})` : ''}</span>
                      )}
                    </div>
                  </div>
                  {canManage ? (
                    <select
                      value={detail.ticket.status}
                      onChange={(e) => changeStatus(e.target.value as TicketStatus)}
                      className="shrink-0 text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20"
                    >
                      {(Object.keys(STATUS_META) as TicketStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded ${STATUS_META[detail.ticket.status].chip}`}>
                      {STATUS_META[detail.ticket.status].label}
                    </span>
                  )}
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                {/* Original message */}
                <ThreadBubble
                  admin={false}
                  name={detail.ticket.user_name || detail.ticket.user_email || 'Account'}
                  when={detail.ticket.created_at}
                  text={detail.ticket.message}
                />
                {detail.replies.map((r) => (
                  <ThreadBubble
                    key={r.id}
                    admin={r.is_admin === 1}
                    name={r.author_name || (r.is_admin ? 'Support' : 'Account')}
                    when={r.created_at}
                    text={r.message}
                  />
                ))}
              </div>

              {/* Reply box */}
              {detail.ticket.status === 'closed' && !canManage ? (
                <div className="px-5 py-4 border-t border-slate-100 text-center text-xs text-slate-400">
                  This ticket is closed. Raise a new ticket if you need further help.
                </div>
              ) : (
                <div className="px-5 py-3 border-t border-slate-100">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                      rows={2}
                      placeholder={canManage ? 'Type your reply to this account…' : 'Add a reply…'}
                      className="flex-1 resize-none px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <FaPaperPlane className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Press ⌘/Ctrl + Enter to send</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── New Ticket Modal ── */}
      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); fetchTickets(); openTicket(id); }}
        />
      )}

      {/* ── Mobile detail drawer ── */}
      {selectedId && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800 truncate">{detail?.ticket.subject || 'Ticket'}</span>
            <button onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 text-slate-400">
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {detail && (
              <>
                <ThreadBubble admin={false} name={detail.ticket.user_name || 'Account'} when={detail.ticket.created_at} text={detail.ticket.message} />
                {detail.replies.map((r) => (
                  <ThreadBubble key={r.id} admin={r.is_admin === 1} name={r.author_name || (r.is_admin ? 'Support' : 'Account')} when={r.created_at} text={r.message} />
                ))}
              </>
            )}
          </div>
          {detail && !(detail.ticket.status === 'closed' && !canManage) && (
            <div className="p-3 border-t border-slate-100 flex items-end gap-2">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2}
                placeholder="Add a reply…"
                className="flex-1 resize-none px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20" />
              <button onClick={sendReply} disabled={sending || !replyText.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#2E3093] text-white text-sm font-semibold disabled:opacity-50">
                <FaPaperPlane className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadBubble({ admin, name, when, text }: { admin: boolean; name: string; when: string; text: string }) {
  return (
    <div className={`flex gap-3 ${admin ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${admin ? 'bg-[#2E3093]/10 text-[#2E3093]' : 'bg-slate-200 text-slate-500'}`}>
        {admin ? <FaUserShield className="w-3.5 h-3.5" /> : <FaUser className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[78%] ${admin ? 'items-end text-right' : ''} flex flex-col`}>
        <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 ${admin ? 'flex-row-reverse' : ''}`}>
          <span className="font-semibold text-slate-600">{name}</span>
          {admin && <FaCircle className="w-1 h-1 text-[#2E3093]" />}
          {admin && <span className="text-[#2E3093] font-medium">Support</span>}
          <span>· {fmtDate(when)}</span>
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words text-left ${
          admin ? 'bg-[#2E3093] text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
        }`}>
          {text}
        </div>
      </div>
    </div>
  );
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!subject.trim() || !message.trim()) { setError('Subject and message are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), category: category.trim() || null, priority, message: message.trim() }),
      });
      const data = await res.json();
      if (data.success) onCreated(data.id);
      else setError(data.error || 'Failed to submit ticket.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => !submitting && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
              <FaLifeRing className="w-5 h-5 text-[#2E3093]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Raise a Query</h3>
              <p className="text-xs text-slate-400">Our team will get back to you here.</p>
            </div>
          </div>
          <button onClick={() => !submitting && onClose()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255}
              placeholder="Brief summary of your query"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80}
                placeholder="e.g. Fees, Login, Reports"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
              placeholder="Describe your query in detail…"
              className="w-full resize-none border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={submitting || !subject.trim() || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</> : <><FaPaperPlane className="w-3.5 h-3.5" /> Submit Ticket</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
