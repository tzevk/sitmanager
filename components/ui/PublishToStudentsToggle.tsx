'use client';

import { useEffect, useState } from 'react';
import type { MarksModule } from '@/lib/marks-publish';

/**
 * "Publish to students" switch for one saved marks sheet. Students see this
 * sheet's marks in the Student Portal only while it is on.
 */
export default function PublishToStudentsToggle({ module, sheetId, canUpdate }: {
  module: MarksModule;
  sheetId: number;
  canUpdate: boolean;
}) {
  const [published, setPublished] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/daily-activities/marks-publish?module=${module}&sheetId=${sheetId}`)
      .then((r) => r.json())
      .then((d) => { if (active) setPublished(Boolean(d?.published)); })
      .catch(() => { if (active) setPublished(false); });
    return () => { active = false; };
  }, [module, sheetId]);

  async function toggle() {
    if (published === null || saving || !canUpdate) return;
    const next = !published;
    if (next && !window.confirm('Publish these marks? Students will see them in the Student Portal.')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/daily-activities/marks-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, sheetId, published: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || 'Failed to update');
      setPublished(Boolean(d.published));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const on = published === true;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${on ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={published === null || saving || !canUpdate}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-emerald-600' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${on ? 'text-emerald-800' : 'text-amber-800'}`}>
          {published === null ? 'Checking…' : on ? 'Published to students' : 'Not published to students'}
        </p>
        <p className="text-xs text-gray-500">
          {on ? 'Students can see these marks in the Student Portal.' : 'Students see "Result pending" until you switch this on.'}
        </p>
      </div>
      {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
