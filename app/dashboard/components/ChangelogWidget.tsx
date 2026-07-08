'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';

type ChangelogEntry = {
  Id: number;
  Title: string;
  Category: string;
  Created_Date: string;
};

const CATEGORY_STYLES: Record<string, string> = {
  Feature: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Fix: 'bg-red-50 text-red-700 border-red-200',
  Improvement: 'bg-sky-50 text-sky-700 border-sky-200',
  Update: 'bg-slate-100 text-slate-600 border-slate-200',
};

function categoryStyle(category: string) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.Update;
}

function formatDate(raw: string) {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return raw;
  }
}

export default function ChangelogWidget() {
  const { canView, loading: permLoading } = useResourcePermissions('changelog');
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading || !canView) return;
    let active = true;
    fetch('/api/changelog?limit=5')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success) setEntries(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [permLoading, canView]);

  if (permLoading || !canView) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          What&rsquo;s New
        </h3>
        <Link href="/dashboard/changelog" className="text-xs font-semibold text-[#2E3093] hover:underline">
          View All
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">No changes logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.Id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${categoryStyle(entry.Category)}`}>
                  {entry.Category}
                </span>
                <span className="text-gray-700 truncate">{entry.Title}</span>
              </div>
              <span className="text-gray-400 shrink-0">{formatDate(entry.Created_Date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
