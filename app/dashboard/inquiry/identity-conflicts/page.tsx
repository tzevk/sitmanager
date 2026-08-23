'use client';

import { useEffect, useState, useCallback } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface ConflictRow {
  Id: number;
  Inquiry_Id: number;
  EnquiryName: string | null;
  Inquiry_Dt: string | null;
  CourseName: string | null;
  Incoming_Mobile: string | null;
  Incoming_Email: string | null;
  Created_At: string;
  Mobile_Person_Id: number | null;
  MobilePersonName: string | null;
  MobilePersonMobile: string | null;
  MobilePersonEmail: string | null;
  Email_Person_Id: number | null;
  EmailPersonName: string | null;
  EmailPersonMobile: string | null;
  EmailPersonEmail: string | null;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return raw;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${iso[3]} ${months[parseInt(iso[2], 10) - 1]} ${iso[1]}`;
}

export default function IdentityConflictsPage() {
  const { canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inquiry/identity-conflicts');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setConflicts(data.conflicts ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConflicts(); }, [fetchConflicts]);

  const resolve = async (conflictId: number, personId: number) => {
    setResolvingId(conflictId);
    setError('');
    try {
      const res = await fetch(`/api/inquiry/identity-conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to resolve');
      setConflicts((prev) => prev.filter((c) => c.Id !== conflictId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setResolvingId(null);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to review identity conflicts." />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2 relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <span className="relative z-10 text-sm font-black text-white tracking-tight">Identity Conflicts</span>
        <span className="relative z-10 ml-2 text-[10px] text-white/40">
          Enquiries whose mobile and email matched two different people — link manually below.
        </span>
      </div>

      {error && <div className="text-xs text-red-600 font-semibold px-1">{error}</div>}

      {loading ? (
        <div className="text-xs text-slate-400 text-center py-8">Loading…</div>
      ) : conflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-xs text-slate-400">
          No pending identity conflicts.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conflicts.map((c) => (
            <div key={c.Id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-700">
                  {c.EnquiryName || '—'} <span className="text-slate-400 font-normal">— {c.CourseName || 'No course'} · {fmtDate(c.Inquiry_Dt)}</span>
                </div>
                <div className="text-[10px] text-slate-400">Flagged {fmtDate(c.Created_At)}</div>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">
                Incoming: {c.Incoming_Mobile || '—'} · {c.Incoming_Email || '—'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-slate-200 rounded-lg p-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Matched by mobile</div>
                  <div className="text-xs font-semibold text-slate-700">{c.MobilePersonName || '—'}</div>
                  <div className="text-[10px] text-slate-500">{c.MobilePersonMobile || '—'} · {c.MobilePersonEmail || '—'}</div>
                  <button
                    onClick={() => c.Mobile_Person_Id && resolve(c.Id, c.Mobile_Person_Id)}
                    disabled={resolvingId === c.Id || !c.Mobile_Person_Id}
                    className="mt-2 w-full px-2 py-1 text-[10px] font-bold bg-[#2E3093] text-white rounded hover:bg-[#252780] transition-colors disabled:opacity-50"
                  >
                    Link to this person
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg p-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Matched by email</div>
                  <div className="text-xs font-semibold text-slate-700">{c.EmailPersonName || '—'}</div>
                  <div className="text-[10px] text-slate-500">{c.EmailPersonMobile || '—'} · {c.EmailPersonEmail || '—'}</div>
                  <button
                    onClick={() => c.Email_Person_Id && resolve(c.Id, c.Email_Person_Id)}
                    disabled={resolvingId === c.Id || !c.Email_Person_Id}
                    className="mt-2 w-full px-2 py-1 text-[10px] font-bold bg-[#2E3093] text-white rounded hover:bg-[#252780] transition-colors disabled:opacity-50"
                  >
                    Link to this person
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
