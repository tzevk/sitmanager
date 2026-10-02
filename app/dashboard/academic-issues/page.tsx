'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FaExclamationCircle, FaSearch, FaTimes, FaExternalLinkAlt, FaLock } from 'react-icons/fa';
import { usePermissions } from '@/lib/permissions-context';
import { PermissionLoading } from '@/components/ui/PermissionGate';

/**
 * Academic Issues monitor: issues students raise from the portal against a
 * specific mark or attendance record. Staff review, ask for information, add
 * internal notes, then resolve/reject — corrections themselves are made in the
 * existing marks/attendance screens ("Correct record"). Resolving can also post
 * a general update on the Notice Board.
 */

type Status = 'OPEN' | 'UNDER_REVIEW' | 'INFO_REQUIRED' | 'RESOLVED' | 'REJECTED';
type Module = 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM' | 'VIVA_MOC' | 'ATTENDANCE';

interface IssueRow {
  id: number;
  student_id: number;
  batch_id: number | null;
  source_module: Module;
  parent_id: number;
  attempt: number | null;
  assessment_name: string;
  record_date: string | null;
  max_marks: number | null;
  shown_to_student: string | null;
  issue_type: string;
  description: string;
  status: Status;
  resolution_note: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
  Student_Name?: string | null;
  Roll_No?: string | null;
  Batch_code?: string | null;
  Course_Name?: string | null;
  Email?: string | null;
  Present_Mobile?: string | null;
}

interface IssueEvent {
  id: number;
  event_type: string;
  from_status: Status | null;
  to_status: Status | null;
  message: string | null;
  is_internal: number;
  actor_type: 'STUDENT' | 'STAFF';
  actor_name: string | null;
  created_at: string;
}

interface Detail {
  issue: IssueRow;
  events: IssueEvent[];
  current: null | ({ kind: 'ATTENDANCE'; topic: string; date: string; present: boolean; late: boolean; faculty: string })
    | ({ kind: 'MARKS'; marksObtained: number | null; maxMarks: number | null; status: string; statusLabel: string; statusConflict: boolean; date: string | null; absentOnLectureDate: boolean | null; published: boolean });
  roll_no: string | null;
  correctionLink: string | null;
}

const STATUS_META: Record<Status, { label: string; chip: string; card: string }> = {
  OPEN: { label: 'Open', chip: 'bg-blue-100 text-blue-700', card: 'border-blue-200 text-blue-700' },
  INFO_REQUIRED: { label: 'Info Required', chip: 'bg-amber-100 text-amber-700', card: 'border-amber-200 text-amber-700' },
  UNDER_REVIEW: { label: 'Under Review', chip: 'bg-indigo-100 text-indigo-700', card: 'border-indigo-200 text-indigo-700' },
  RESOLVED: { label: 'Resolved', chip: 'bg-emerald-100 text-emerald-700', card: 'border-emerald-200 text-emerald-700' },
  REJECTED: { label: 'Rejected', chip: 'bg-red-100 text-red-700', card: 'border-red-200 text-red-700' },
};
const STATUS_ORDER: Status[] = ['OPEN', 'INFO_REQUIRED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

const MODULE_LABEL: Record<Module, string> = {
  ASSIGNMENT: 'Assignment Test', UNIT_TEST: 'Unit Test', FINAL_EXAM: 'Final Exam', VIVA_MOC: 'Viva / MOC', ATTENDANCE: 'Attendance',
};

const EVENT_LABEL: Record<string, string> = {
  RAISED: 'Raised by student',
  STATUS: 'Moved to review',
  INFO_REQUESTED: 'Information requested',
  STUDENT_REPLY: 'Student replied',
  NOTE: 'Internal note',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  REOPENED: 'Reopened',
  NOTICE_POSTED: 'Notice posted',
};

function fmtDate(s: string | null) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Action = 'review' | 'request_info' | 'note' | 'resolve' | 'reject' | 'reopen';
const ACTIONS: Record<Action, { label: string; from: Status[] | 'any'; needsMessage: boolean; placeholder: string; btn: string }> = {
  review: { label: 'Start review', from: ['OPEN', 'INFO_REQUIRED'], needsMessage: false, placeholder: 'Optional message to the student', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  request_info: { label: 'Request info', from: ['OPEN', 'UNDER_REVIEW'], needsMessage: true, placeholder: 'What do you need from the student?', btn: 'bg-amber-600 hover:bg-amber-700' },
  note: { label: 'Internal note', from: 'any', needsMessage: true, placeholder: 'Visible to staff only', btn: 'bg-slate-700 hover:bg-slate-800' },
  resolve: { label: 'Resolve', from: ['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED'], needsMessage: true, placeholder: 'What was done? The student sees this.', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  reject: { label: 'Reject', from: ['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED'], needsMessage: true, placeholder: 'Why is the record correct? The student sees this.', btn: 'bg-red-600 hover:bg-red-700' },
  reopen: { label: 'Reopen', from: ['RESOLVED', 'REJECTED'], needsMessage: true, placeholder: 'Why is this being reopened?', btn: 'bg-[#2E3093] hover:bg-[#25277a]' },
};

export default function AcademicIssuesPage() {
  const { loading: sessionLoading } = usePermissions();

  const [rows, setRows] = useState<IssueRow[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({});
  const [batches, setBatches] = useState<Array<{ id: number; code: string | null }>>([]);
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canPostNotice, setCanPostNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [status, setStatus] = useState<'ACTIVE' | 'ALL' | Status>('ACTIVE');
  const [moduleFilter, setModuleFilter] = useState('');
  const [batchId, setBatchId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [action, setAction] = useState<Action | null>(null);
  const [message, setMessage] = useState('');
  const [postNotice, setPostNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const q = new URLSearchParams({ status });
    if (moduleFilter) q.set('module', moduleFilter);
    if (batchId) q.set('batchId', batchId);
    if (type) q.set('type', type);
    if (debounced) q.set('search', debounced);
    fetch(`/api/academic-issues?${q}`, { cache: 'no-store' })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.message || d.error || 'Could not load issues');
        setRows(d.issues ?? []);
        setCounts(d.counts ?? {});
        setBatches(d.batches ?? []);
        setIssueTypes(d.issueTypes ?? []);
        setCanManage(Boolean(d.canManage));
        setCanPostNotice(Boolean(d.canPostNotice));
        setLoadError('');
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load issues'))
      .finally(() => setLoading(false));
  }, [status, moduleFilter, batchId, type, debounced]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback((id: number) => {
    setDetailLoading(true);
    fetch(`/api/academic-issues/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  const openIssue = (id: number) => {
    setSelectedId(id);
    setDetail(null);
    setAction(null);
    setMessage('');
    setActionError('');
    loadDetail(id);
  };
  const closeDrawer = () => { setSelectedId(null); setDetail(null); setAction(null); };

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, saving]);

  const chooseAction = (a: Action) => {
    setAction(a);
    setMessage('');
    setActionError('');
    setPostNotice(false);
    if (a === 'resolve' && detail) {
      const i = detail.issue;
      // Notices go to every student — keep it general, never personal details.
      setNoticeTitle(`Academic update${i.Batch_code ? ` — Batch ${i.Batch_code}` : ''}`);
      setNoticeText(`${MODULE_LABEL[i.source_module]} "${i.assessment_name}" has been reviewed and the records have been updated where needed. Please check your Student Portal.`);
    }
  };

  const submitAction = async () => {
    if (!selectedId || !action) return;
    const spec = ACTIONS[action];
    if (spec.needsMessage && message.trim().length < 2) { setActionError('Please add a message.'); return; }
    if (postNotice && (!noticeTitle.trim() || !noticeText.trim())) { setActionError('The notice needs a title and text.'); return; }
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/academic-issues/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          message: message.trim(),
          notice: action === 'resolve' && postNotice ? { title: noticeTitle.trim(), text: noticeText.trim() } : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setActionError(d.error || d.message || 'Could not save.'); return; }
      setAction(null);
      setMessage('');
      loadDetail(selectedId);
      load();
    } catch {
      setActionError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading) return <PermissionLoading />;

  const activeCount = (counts.OPEN ?? 0) + (counts.UNDER_REVIEW ?? 0) + (counts.INFO_REQUIRED ?? 0);
  const selectCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-[#2E3093] focus:outline-none';

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2E3093]/10">
              <FaExclamationCircle className="h-5 w-5 text-[#2E3093]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Academic Issues</h1>
              <p className="text-xs text-slate-400">Raised by students from the portal against marks and attendance · {activeCount} active</p>
            </div>
          </div>
        </div>

        {/* Status board */}
        <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          <button onClick={() => setStatus('ACTIVE')}
            className={`rounded-lg border px-3 py-2.5 text-left transition ${status === 'ACTIVE' ? 'border-[#2E3093] bg-[#2E3093] text-white' : 'border-slate-200 text-slate-700 hover:border-[#2E3093]/40'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Active</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${status === s ? 'border-[#2E3093] ring-2 ring-[#2E3093]/20' : 'hover:bg-slate-50'} ${STATUS_META[s].card}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{STATUS_META[s].label}</p>
              <p className="text-xl font-bold">{counts[s] ?? 0}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <div className="relative min-w-[200px] flex-1">
            <FaSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student, roll no., test or #id"
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-[#2E3093] focus:outline-none" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls} aria-label="Status">
            <option value="ACTIVE">Active</option>
            <option value="ALL">All statuses</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selectCls} aria-label="Record type">
            <option value="">All records</option>
            {(Object.keys(MODULE_LABEL) as Module[]).map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}
          </select>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={selectCls} aria-label="Batch">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.code ?? `#${b.id}`}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls} aria-label="Issue type">
            <option value="">All issue types</option>
            {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading issues…</div>
        ) : loadError ? (
          <div className="p-10 text-center text-sm text-red-600">{loadError} <button onClick={load} className="ml-2 underline">Retry</button></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No issues match these filters.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => openIssue(r.id)} className={`cursor-pointer hover:bg-slate-50 ${selectedId === r.id ? 'bg-[#2E3093]/5' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">#{r.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.Student_Name ?? `Student ${r.student_id}`}</p>
                        <p className="text-xs text-slate-400">{r.Roll_No ? `Roll ${r.Roll_No}` : '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.Batch_code ?? '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-[#2A6BB5]">{MODULE_LABEL[r.source_module]}</p>
                        <p className="max-w-[240px] truncate text-slate-700">{r.assessment_name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.issue_type}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[r.status].chip}`}>{STATUS_META[r.status].label}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => openIssue(r.id)} className="w-full px-4 py-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800">{r.Student_Name ?? `Student ${r.student_id}`}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[r.status].chip}`}>{STATUS_META[r.status].label}</span>
                    </div>
                    <p className="text-xs text-slate-500">#{r.id} · {r.Batch_code ?? '—'}{r.Roll_No ? ` · Roll ${r.Roll_No}` : ''}</p>
                    <p className="mt-1 text-xs text-slate-700"><span className="font-semibold text-[#2A6BB5]">{MODULE_LABEL[r.source_module]}</span> · {r.assessment_name}</p>
                    <p className="text-xs text-slate-500">{r.issue_type} · {fmtDate(r.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Issue #${selectedId}`}>
          <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => !saving && closeDrawer()} />
          <div className="relative flex h-full w-full flex-col bg-white shadow-xl sm:max-w-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs text-slate-400">Issue #{selectedId}</p>
                <h2 className="text-base font-bold text-slate-800">{detail?.issue.Student_Name ?? 'Loading…'}</h2>
              </div>
              <button onClick={closeDrawer} disabled={saving} className="rounded-md p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><FaTimes /></button>
            </div>

            {detailLoading && !detail ? (
              <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
            ) : !detail ? (
              <div className="p-10 text-center text-sm text-red-600">Could not load this issue.</div>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {(() => {
                  const i = detail.issue;
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[i.status].chip}`}>{STATUS_META[i.status].label}</span>
                        <span className="text-xs text-slate-500">{i.issue_type}</span>
                        {i.assigned_to_name && <span className="text-xs text-slate-400">· Handled by {i.assigned_to_name}</span>}
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div><dt className="text-slate-400">Roll no.</dt><dd className="font-medium text-slate-700">{detail.roll_no ?? '—'}</dd></div>
                        <div><dt className="text-slate-400">Batch</dt><dd className="font-medium text-slate-700">{i.Batch_code ?? '—'}{i.Course_Name ? ` · ${i.Course_Name}` : ''}</dd></div>
                        <div><dt className="text-slate-400">Mobile</dt><dd className="font-medium text-slate-700">{i.Present_Mobile || '—'}</dd></div>
                        <div><dt className="text-slate-400">Email</dt><dd className="truncate font-medium text-slate-700">{i.Email || '—'}</dd></div>
                      </dl>

                      <div className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[#2A6BB5]">{MODULE_LABEL[i.source_module]}{i.attempt && i.attempt >= 2 ? ` · Attempt ${i.attempt}` : ''}</p>
                            <p className="text-sm font-semibold text-slate-800">{i.assessment_name}</p>
                            <p className="text-xs text-slate-500">{i.record_date ?? 'No date'}{i.max_marks !== null ? ` · Max. ${Number(i.max_marks)}` : ''}</p>
                          </div>
                          {detail.correctionLink && canManage && (
                            <Link href={detail.correctionLink} target="_blank"
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#2E3093]/30 px-2.5 py-1.5 text-xs font-semibold text-[#2E3093] hover:bg-[#2E3093]/5">
                              Correct record <FaExternalLinkAlt className="h-2.5 w-2.5" />
                            </Link>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-slate-50 p-2">
                            <p className="text-slate-400">Student saw (when raised)</p>
                            <p className="font-semibold text-slate-700">{i.shown_to_student ?? '—'}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-2">
                            <p className="text-slate-400">CRM record now</p>
                            <p className="font-semibold text-slate-700">
                              {!detail.current ? 'Not found in the student’s current batch'
                                : detail.current.kind === 'ATTENDANCE'
                                  ? (detail.current.present ? (detail.current.late ? 'Present (late)' : 'Present') : 'Absent')
                                  : detail.current.marksObtained !== null
                                    ? `${detail.current.marksObtained}${detail.current.maxMarks !== null ? ` / ${detail.current.maxMarks}` : ''} · ${detail.current.statusLabel}`
                                    : detail.current.statusLabel}
                            </p>
                            {detail.current?.kind === 'MARKS' && detail.current.absentOnLectureDate && <p className="text-amber-700">Absent on lecture date</p>}
                            {detail.current?.kind === 'MARKS' && !detail.current.published && <p className="text-slate-400">Not yet published to student</p>}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Student&apos;s description</p>
                        <p className="whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-sm text-slate-700">{i.description}</p>
                      </div>

                      {i.resolution_note && (i.status === 'RESOLVED' || i.status === 'REJECTED') && (
                        <div className={`rounded-lg border p-3 text-sm ${i.status === 'RESOLVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                          <p className="text-xs font-semibold">{i.status === 'RESOLVED' ? 'Resolution' : 'Rejection reason'} · {i.resolved_by_name} · {fmtDate(i.resolved_at)}</p>
                          <p className="mt-1 whitespace-pre-wrap">{i.resolution_note}</p>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-500">Timeline</p>
                        <ol className="ml-1.5 space-y-3 border-l border-slate-200">
                          {detail.events.map((e) => (
                            <li key={e.id} className="relative pl-4">
                              <span className={`absolute -left-[5.5px] top-1 h-2.5 w-2.5 rounded-full ${e.is_internal ? 'bg-slate-400' : e.actor_type === 'STUDENT' ? 'bg-[#2A6BB5]' : 'bg-[#2E3093]'}`} aria-hidden />
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                {e.is_internal ? <FaLock className="h-2.5 w-2.5 text-slate-400" /> : null}
                                {EVENT_LABEL[e.event_type] ?? e.event_type}
                                <span className="font-normal text-slate-400">· {e.actor_type === 'STUDENT' ? 'Student' : e.actor_name ?? 'Staff'} · {fmtDate(e.created_at)}</span>
                              </p>
                              {e.message && <p className={`mt-1 whitespace-pre-wrap text-sm ${e.is_internal ? 'rounded bg-slate-50 p-2 text-slate-600' : 'text-slate-600'}`}>{e.message}</p>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {detail && canManage && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ACTIONS) as Action[])
                    .filter((a) => ACTIONS[a].from === 'any' || (ACTIONS[a].from as Status[]).includes(detail.issue.status))
                    .map((a) => (
                      <button key={a} onClick={() => chooseAction(a)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${action === a ? `${ACTIONS[a].btn} text-white` : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
                        {ACTIONS[a].label}
                      </button>
                    ))}
                </div>
                {action && (
                  <div className="mt-3 space-y-2">
                    <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={ACTIONS[action].placeholder}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#2E3093] focus:outline-none" />
                    {action === 'resolve' && canPostNotice && (
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input type="checkbox" checked={postNotice} onChange={(e) => setPostNotice(e.target.checked)} />
                          Also post an update on the Notice Board
                        </label>
                        {postNotice && (
                          <div className="mt-2 space-y-2">
                            <p className="text-[11px] text-amber-700">Notices are shown to all students — keep it general, no names or marks.</p>
                            <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} maxLength={255}
                              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:border-[#2E3093] focus:outline-none" aria-label="Notice title" />
                            <textarea rows={3} value={noticeText} onChange={(e) => setNoticeText(e.target.value)}
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#2E3093] focus:outline-none" aria-label="Notice text" />
                          </div>
                        )}
                      </div>
                    )}
                    {actionError && <p className="text-xs text-red-600" role="alert">{actionError}</p>}
                    <div className="flex gap-2">
                      <button onClick={submitAction} disabled={saving} className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${ACTIONS[action].btn}`}>
                        {saving ? 'Saving…' : `Confirm: ${ACTIONS[action].label}`}
                      </button>
                      <button onClick={() => setAction(null)} disabled={saving} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
