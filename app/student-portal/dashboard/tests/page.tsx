'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IssueButton, useIssueTracker } from '../_components/RaiseIssue';

/**
 * All of the student's tests: assignment tests, unit tests and final exam
 * sittings (with re-exam attempts). Marks only show once a result is published
 * (decided on the server); until then rows read "Result pending".
 */

type Module = 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM';

interface TestRecord {
  sourceModule: Module;
  parentId: number;
  assessmentName: string;
  assessmentNo: number | null;
  attempt: number | null;
  date: string | null;
  maxMarks: number | null;
  marksObtained: number | null;
  status: 'EVALUATED' | 'ABSENT' | 'NOT_SUBMITTED' | 'NOT_EVALUATED' | 'RESULT_PENDING' | 'NOT_APPLICABLE';
  published: boolean;
  absentOnLectureDate: boolean | null;
}

const TYPE_LABEL: Record<Module, string> = { ASSIGNMENT: 'Assignment Test', UNIT_TEST: 'Unit Test', FINAL_EXAM: 'Final Exam' };
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ASSIGNMENT', label: 'Assignment' },
  { key: 'UNIT_TEST', label: 'Unit' },
  { key: 'FINAL_EXAM', label: 'Final' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const pad = (n: number) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ATTEMPT_LABEL = ['', '1st attempt', 'Re-exam (2nd attempt)', 'Re-exam (3rd attempt)'];

function display(r: TestRecord, today: string): { text: string; tone: string } {
  // 0 is a real mark — check for null, never falsy.
  if (r.status === 'EVALUATED' && r.marksObtained !== null) {
    return { text: r.maxMarks !== null ? `${r.marksObtained} / ${r.maxMarks}` : String(r.marksObtained), tone: 'bg-[#2E3093]/[0.06] text-[#2E3093] border-[#2E3093]/20' };
  }
  switch (r.status) {
    case 'RESULT_PENDING': return { text: 'Result pending', tone: 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]' };
    case 'NOT_EVALUATED':
      return r.date && r.date.slice(0, 10) > today
        ? { text: 'Scheduled', tone: 'bg-[#2A6BB5]/[0.08] text-[#2A6BB5] border-[#2A6BB5]/20' }
        : { text: 'Not recorded yet', tone: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]' };
    case 'NOT_SUBMITTED': return { text: 'Not submitted', tone: 'bg-red-50 text-red-700 border-red-200' };
    case 'ABSENT': return { text: 'Absent', tone: 'bg-red-50 text-red-700 border-red-200' };
    default: return { text: '—', tone: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]' };
  }
}

export default function StudentTestsPage() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [today, setToday] = useState('');
  const issues = useIssueTracker();

  const load = useCallback(() => {
    fetch('/api/student-portal/tests', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        setRecords(Array.isArray(d.records) ? d.records : []);
        setToday(localToday());
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => {
    const sorted = [...records].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    return {
      list: filter === 'all' ? sorted : sorted.filter((r) => r.sourceModule === filter),
      count: (k: Filter) => (k === 'all' ? records.length : records.filter((r) => r.sourceModule === k).length),
      published: records.filter((r) => r.status === 'EVALUATED' && r.published).length,
      awaiting: records.filter((r) => r.status === 'RESULT_PENDING').length,
    };
  }, [records, filter]);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-[#52525B]">Couldn&apos;t load your tests.</p>
        <button onClick={() => { setState('loading'); load(); }} className="mt-3 rounded-md bg-[#2E3093] px-4 py-2 text-sm font-medium text-white">Retry</button>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="bg-[#2E3093] px-5 pt-6 pb-10">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">Tests</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-6xl font-black text-white leading-none">{records.length}</p>
          <p className="text-sm font-semibold text-white/50 mb-1.5">recorded</p>
        </div>
        <p className="text-white/50 text-[11px] mt-3">
          Assignment tests, unit tests and final exams. Marks appear once results are published.
        </p>
      </div>

      {/* Stats strip */}
      <div className="px-4 -mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: records.length, color: 'text-gray-900' },
          { label: 'Published', value: view.published, color: 'text-[#2E3093]' },
          { label: 'Awaiting', value: view.awaiting, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 mt-4">
        <div className="flex items-center gap-1 mb-3 bg-white border border-[#2E3093]/10 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${filter === f.key ? 'bg-[#2E3093] text-white' : 'text-[#2A6BB5]/60'}`}>
              {f.label} ({view.count(f.key)})
            </button>
          ))}
        </div>

        {view.list.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
            {records.length === 0 ? 'No tests recorded yet' : 'No tests of this type yet'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {view.list.map((r) => {
              const shown = display(r, today);
              const attempt = r.sourceModule === 'FINAL_EXAM' && r.attempt && r.attempt >= 2 ? ATTEMPT_LABEL[r.attempt] : null;
              return (
                <div key={`${r.sourceModule}-${r.parentId}`} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{r.assessmentName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      <span className="font-semibold text-[#2A6BB5]">{TYPE_LABEL[r.sourceModule]}</span>
                      {attempt && <span className="text-[#2E3093]"> · {attempt}</span>}
                      {' · '}{fmtDate(r.date)}
                      {r.maxMarks !== null && ` · Max. ${r.maxMarks}`}
                    </p>
                    {r.absentOnLectureDate === true && <p className="text-[11px] text-amber-700 mt-0.5">Absent on lecture date</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${shown.tone}`}>{shown.text}</span>
                    {shown.text !== 'Scheduled' && (
                      <IssueButton tracker={issues} target={{
                        sourceModule: r.sourceModule, parentId: r.parentId, title: r.assessmentName,
                        subtitle: `${TYPE_LABEL[r.sourceModule]}${attempt ? ` · ${attempt}` : ''} · ${fmtDate(r.date)}${r.maxMarks !== null ? ` · Max. ${r.maxMarks} marks` : ''}`,
                        shown: shown.text,
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {issues.sheet}
    </div>
  );
}
