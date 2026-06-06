'use client';

import { useEffect, useState } from 'react';
import { toBatchNumber } from '@/lib/batch-display';

type ClosedBatch = {
  Batch_Id: number;
  Batch_code: string;
  Course_Name?: string | null;
  SDate?: string | null;
  EDate?: string | null;
  Timings?: string | null;
};

function formatDate(raw?: string | null) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClosedBatchesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClosedBatch[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/trainer-portal/lectures');
        const d = await r.json();
        setRows(Array.isArray(d?.closed_batches) ? d.closed_batches : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-3xl mx-auto">
        <div className="h-10 w-52 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Closed Batches</h1>
        <p className="text-base text-gray-500 mt-0.5">Batches automatically move here after end date.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Total Closed: {rows.length}</h2>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No closed batches found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((b) => (
              <div key={b.Batch_Id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-gray-800">{toBatchNumber(b.Batch_code)}</p>
                  <p className="text-sm text-gray-500">{b.Course_Name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(b.SDate)} to {formatDate(b.EDate)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-[#2E3093]">{b.Timings?.trim() || 'Timing not set'}</p>
                  <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    Closed
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
