'use client';

import { useEffect, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type ChangelogEntry = {
  Id: number;
  Title: string;
  Description: string | null;
  Category: string;
  Author: string | null;
  Created_Date: string;
};

const CATEGORIES = ['Feature', 'Fix', 'Improvement', 'Update'] as const;

const CATEGORY_STYLES: Record<string, string> = {
  Feature: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Fix: 'bg-red-50 text-red-700 border-red-200',
  Improvement: 'bg-sky-50 text-sky-700 border-sky-200',
  Update: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CATEGORY_ACTIVE_STYLES: Record<string, string> = {
  Feature: 'bg-emerald-600 border-emerald-600 text-white',
  Fix: 'bg-red-600 border-red-600 text-white',
  Improvement: 'bg-sky-600 border-sky-600 text-white',
  Update: 'bg-slate-600 border-slate-600 text-white',
};

function categoryStyle(category: string) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.Update;
}

function formatDate(raw: string) {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return raw;
  }
}

export default function ChangelogPage() {
  const { canView, canCreate, loading: permLoading } = useResourcePermissions('changelog');
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Feature');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadEntries = () => {
    setLoading(true);
    fetch('/api/changelog?limit=200')
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load changelog');
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load changelog'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    setSaveMsg('');
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to add entry');
      setTitle('');
      setDescription('');
      setCategory('Feature');
      setSaveMsg('Entry added.');
      loadEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the software changelog." />;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <h2 className="text-base font-bold text-white">Software Changelog</h2>
        <p className="text-xs text-white/70 mt-0.5">What&rsquo;s new and changed in the system, most recent first</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{error}</div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${canCreate ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 min-w-0">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading changelog...</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No changes logged yet.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.Id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryStyle(entry.Category)}`}>
                        {entry.Category}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{entry.Title}</span>
                    </div>
                    {entry.Description && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{entry.Description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">{formatDate(entry.Created_Date)}</p>
                    {entry.Author && <p className="text-[11px] text-gray-400 mt-0.5">{entry.Author}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {canCreate && (
          <div className="lg:sticky lg:top-4 self-start bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 h-fit">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Add Entry</h3>
              <p className="text-xs text-gray-400 mt-0.5">Log a change so everyone stays updated.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      category === c ? CATEGORY_ACTIVE_STYLES[c] : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Added roll number duplicate cleanup"
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description <span className="normal-case font-medium text-gray-400">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="A sentence or two of detail, if useful."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
            </div>

            {saveMsg && (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{saveMsg}</p>
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !title.trim()}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252778] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
