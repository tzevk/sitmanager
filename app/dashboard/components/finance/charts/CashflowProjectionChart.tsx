'use client';

import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { CashflowProjection } from '../shared/types';
import type { CashflowForecast } from '../shared/predictions';
import { fmt, monthLabel, parseMonth } from '../shared/format';

const fmtLakh = (v: number) =>
  v >= 1_00_00_000 ? `₹${(v / 1_00_00_000).toFixed(1)}Cr`
  : v >= 1_00_000   ? `₹${(v / 1_00_000).toFixed(1)}L`
  : `₹${v.toLocaleString('en-IN')}`;

interface DataPoint {
  month: string;
  revenue: number;
  expenses: number;
  loan: number;
  net: number;
  isForecast?: boolean;
}

interface Props {
  projections: CashflowProjection[];
  forecast?: CashflowForecast[];
}

export default function CashflowProjectionChart({ projections, forecast = [] }: Props) {
  const data: DataPoint[] = useMemo(() => {
    const actual: DataPoint[] = [...projections]
      .sort((a, b) => parseMonth(a.month).localeCompare(parseMonth(b.month)))
      .map(r => ({
        month:       monthLabel(parseMonth(r.month)),
        revenue:     Number(r.revenue         || 0),
        expenses:    Number(r.expenses        || 0),
        loan:        Number(r.loan_repayment  || 0),
        net:         Number(r.revenue || 0) - Number(r.expenses || 0) - Number(r.loan_repayment || 0),
        isForecast:  false,
      }));

    const fc: DataPoint[] = forecast.map(f => ({
      month:      f.month,
      revenue:    f.revenue,
      expenses:   f.expenses,
      loan:       f.loan,
      net:        f.net,
      isForecast: true,
    }));

    return [...actual, ...fc];
  }, [projections, forecast]);

  // Index where forecast starts (for ReferenceLine)
  const forecastStartIdx = data.findIndex(d => d.isForecast);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-xs text-gray-400">
        Add cashflow projections to see the forecast chart.
      </div>
    );
  }

  const forecastMonth = forecastStartIdx >= 0 ? data[forecastStartIdx].month : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider">Projected Cashflow Forecast</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Revenue · Expenses · Loan Repayment · Net (line)</p>
        </div>
        {forecastMonth && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Forecast from {forecastMonth}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" fontSize={10} tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis fontSize={10} tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={fmtLakh} width={58} />
            <Tooltip
              formatter={(v, name) => [fmt(Number(v)), name]}
              labelFormatter={(label, payload) => {
                const isFc = payload?.[0]?.payload?.isForecast;
                return `${label}${isFc ? '  (AI Forecast)' : ''}`;
              }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / .05)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />

            {/* Forecast boundary line */}
            {forecastMonth && (
              <ReferenceLine
                x={forecastMonth}
                stroke="#7c3aed"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: 'Forecast →', position: 'insideTopRight', fontSize: 9, fill: '#7c3aed', dy: -4 }}
              />
            )}

            <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill="#2E3093" fillOpacity={d.isForecast ? 0.35 : 0.85} stroke={d.isForecast ? '#2E3093' : 'none'} strokeWidth={d.isForecast ? 1 : 0} strokeDasharray={d.isForecast ? '3 2' : ''} />
              ))}
            </Bar>
            <Bar dataKey="expenses" name="Expenses" radius={[4,4,0,0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill="#E84118" fillOpacity={d.isForecast ? 0.35 : 0.85} />
              ))}
            </Bar>
            <Bar dataKey="loan" name="Loan Repayment" radius={[4,4,0,0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill="#F59E0B" fillOpacity={d.isForecast ? 0.35 : 0.85} />
              ))}
            </Bar>
            <Line
              dataKey="net"
              stroke="#10B981"
              strokeWidth={2.5}
              strokeDasharray="0"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={`dot-${props.index}`}
                    cx={cx} cy={cy} r={payload.isForecast ? 5 : 4}
                    fill={payload.isForecast ? '#7c3aed' : '#fff'}
                    stroke={payload.isForecast ? '#7c3aed' : '#10B981'}
                    strokeWidth={2}
                    strokeDasharray={payload.isForecast ? '3 2' : ''}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              name="Net Cashflow"
            />
          </ComposedChart>
        </ResponsiveContainer>
    </div>
  );
}
