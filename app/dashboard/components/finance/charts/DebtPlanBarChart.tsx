'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import type { DebtPlan } from '../shared/types';
import { fmt } from '../shared/format';

const fmtLakh = (v: number) =>
  v >= 1_00_00_000 ? `₹${(v / 1_00_00_000).toFixed(1)}Cr`
  : v >= 1_00_000   ? `₹${(v / 1_00_000).toFixed(1)}L`
  : `₹${v.toLocaleString('en-IN')}`;

export default function DebtPlanBarChart({ plans }: { plans: DebtPlan[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { bank: string; planned: number; paid: number; overdue: number }>();
    for (const r of plans) {
      const cur = map.get(r.bank_name) ?? { bank: r.bank_name, planned: 0, paid: 0, overdue: 0 };
      cur.planned += Number(r.emi_amount  || 0);
      cur.paid    += Number(r.actual_paid || 0);
      if (r.status === 'Overdue') cur.overdue += Number(r.emi_amount || 0);
      map.set(r.bank_name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.planned - a.planned);
  }, [plans]);

  if (data.length === 0) {
    return (
      <div className="h-full min-h-[220px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
        No debt plan data to chart.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 h-full">
      <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-1">
        EMI Planned vs Actual Paid — by Bank
      </p>
      <p className="text-[10px] text-gray-400 mb-3">Grouped by lender across all entries</p>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="bank" fontSize={10} tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis fontSize={10} tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={fmtLakh} width={55} />
            <Tooltip
              formatter={(v) => fmt(Number(v))}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / .05)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="planned" fill="#2E3093" name="Planned EMI" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((_, i) => <Cell key={i} fill="#2E3093" fillOpacity={0.85} />)}
            </Bar>
            <Bar dataKey="paid" fill="#10B981" name="Actual Paid" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((d, i) => <Cell key={i} fill={d.overdue > 0 ? '#EF4444' : '#10B981'} fillOpacity={0.9} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
