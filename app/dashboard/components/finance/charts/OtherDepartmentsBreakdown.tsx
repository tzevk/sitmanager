'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import type { CashflowTxn } from '../shared/types';
import { fmt } from '../shared/format';
import { CBD_COMBINED_DEPTS, NAMED_DEPTS } from './CashflowCategoryBars';

interface Row { department: string; payment: number }

/** Title-case a raw ALL-CAPS department name, keeping "&"/short joiners as-is. */
function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(' ')
    .map((w) => (w === '&' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Same compact Indian-unit formatting as the sibling department/category charts. */
function fmtCompact(v: number): string {
  if (!v || v <= 0) return '';
  if (v >= 1_00_00_000) return `${(v / 1_00_00_000).toFixed(1)} Cr`;
  if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)} L`;
  return v.toLocaleString('en-IN');
}

/**
 * Drill-down for the "Other Departments" bar in the Payment vs Receipt by
 * Department chart above — that bar is a catch-all for every department not
 * broken out into its own named bucket (CBD/Trainers/T&D merge into CBD;
 * Deputation Accent, Corporate Training, Project Accent get their own bars).
 * This shows what's actually inside it, ranked by expense.
 */
export default function OtherDepartmentsBreakdown({ rows }: { rows: CashflowTxn[] }) {
  const data: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const rawDept = (r.department || 'Unassigned').toUpperCase();
      const isNamed = CBD_COMBINED_DEPTS.includes(rawDept) || rawDept in NAMED_DEPTS;
      if (isNamed) continue;
      const label = rawDept === 'UNASSIGNED' ? 'Unassigned' : titleCase(rawDept);
      const cur = map.get(label) ?? { department: label, payment: 0 };
      cur.payment += Number(r.payment || 0);
      map.set(label, cur);
    }
    return Array.from(map.values())
      .filter((d) => d.payment > 0)
      .sort((a, b) => b.payment - a.payment);
  }, [rows]);

  const total = useMemo(() => data.reduce((s, d) => s + d.payment, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">
        No expenses under Other Departments for the current filters.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-0.5">
        Other Departments — Expense Breakdown
      </p>
      <p className="text-[10px] text-gray-400 mb-3">
        {data.length} department{data.length === 1 ? '' : 's'} · Total {fmt(total)}
      </p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            fontSize={10}
            tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v))}
          />
          <YAxis type="category" dataKey="department" fontSize={11} width={140} tickLine={false} />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="payment" name="Expense" fill="#E84118" radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="payment" position="right" formatter={(v: unknown) => fmtCompact(Number(v) || 0)} fontSize={10} fontWeight={600} fill="#E84118" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
