'use client';

import { lazy, Suspense, useState } from 'react';
import { ToastProvider } from './finance/shared/ToastProvider';
import RevenueByDeptChart from './finance/charts/RevenueByDeptChart';

/* Lazy-load tab panels so the initial bundle only ships Overview. */
const OverviewTab    = lazy(() => import('./finance/tabs/OverviewTab'));
const CbdTab         = lazy(() => import('./finance/tabs/CbdTab'));
const CtTab          = lazy(() => import('./finance/tabs/CtTab'));
const DeputationTab  = lazy(() => import('./finance/tabs/MonthlyTab').then(m => ({ default: m.DeputationTab })));
const ProjectsTab    = lazy(() => import('./finance/tabs/MonthlyTab').then(m => ({ default: m.ProjectsTab })));
const DebtTab        = lazy(() => import('./finance/tabs/DebtTab'));
const CashflowTab    = lazy(() => import('./finance/tabs/CashflowTab'));

const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'cbd',
    label: 'CBD / Inhouse',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: 'ct',
    label: 'Corporate Training',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'deputation',
    label: 'Deputation',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    id: 'debt',
    label: 'Debt Repayment',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: 'cashflow',
    label: 'Cashflow',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const;
type TabId = typeof TABS[number]['id'];

function TabFallback() {
  return (
    <div className="space-y-4 py-4">
      <div className="flex gap-3">
        {[120, 88, 96, 104].map(w => (
          <div key={w} className="rounded-xl border border-gray-200 p-4 flex-1">
            <div className="h-2.5 w-16 rounded-full bg-gray-200/80 animate-pulse mb-3" />
            <div className="h-5 w-20 rounded-full bg-gray-200/60 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-48 rounded-xl bg-gray-100/60 animate-pulse" />
    </div>
  );
}

function TabPanel({ id }: { id: TabId }) {
  switch (id) {
    case 'overview':   return <OverviewTab />;
    case 'cbd':        return <CbdTab />;
    case 'ct':         return <CtTab />;
    case 'deputation': return <DeputationTab />;
    case 'projects':   return <ProjectsTab />;
    case 'debt':       return <DebtTab />;
    case 'cashflow':   return <CashflowTab />;
  }
}

export default function FinanceFullDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const year = new Date().getFullYear();

  return (
    <ToastProvider>
      {/* Full-height sticky container — header + tabs fixed, content scrolls */}
      <div className="flex flex-col h-[calc(100vh-80px)] rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">

        {/* Header — never scrolls */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#2E3093] to-[#3d40a8] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl p-2.5 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Finance Dashboard</h1>
              <p className="text-xs text-white/60 mt-0.5">
                CBD / Inhouse · Corporate Training · Deputation · Projects · Cashflow · FY {year}–{String(year + 1).slice(-2)}
              </p>
            </div>
          </div>
        </div>

        {/* Tab bar — never scrolls */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-3 py-2 shadow-sm">
          <div role="tablist" className="flex gap-1 overflow-x-auto scrollbar-none">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-lg transition-all ${
                  activeTab === t.id
                    ? 'bg-[#2E3093] text-white shadow-sm shadow-[#2E3093]/30'
                    : 'text-gray-500 hover:text-[#2E3093] hover:bg-[#2E3093]/5'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — this is the only part that scrolls */}
        <div className="flex-1 overflow-y-auto p-5">
          <Suspense fallback={<TabFallback />}>
            <TabPanel id={activeTab} />
          </Suspense>

          {/* Year-wide revenue chart — only on Overview */}
          {activeTab === 'overview' && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <RevenueByDeptChart year={year} />
            </div>
          )}
        </div>

      </div>
    </ToastProvider>
  );
}
