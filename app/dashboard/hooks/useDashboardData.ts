/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from 'react';

/**
 * Progressive dashboard data hook.
 * Fetches stats → summary → reports in priority order.
 * Each tier triggers an independent state update so the UI can
 * render data as soon as it arrives (no all-or-nothing blocking).
 */

interface QuickStats {
  totalStudents: number;
  activeCourses: number;
  activeBatches: number;
  totalFaculty: number;
}

interface SummaryData {
  upcomingBatches: any[];
  enquiryReport: {
    summary: { total_enquiries: number; last_30_days: number; last_7_days: number };
    corporateTotal: number;
    recentCorporate: any[];
  };
  notices: any[];
  companyRequirements: {
    activeRequirements: number;
    list: any[];
  };
}

interface ReportsData {
  annualTargets: {
    batchTargets: any[];
    sparklineData: any[];
  };
  placementReport: {
    rows: any[];
    sparkMap: Record<number, number[]>;
  };
}

export interface DashboardState {
  stats: QuickStats | null;
  summary: SummaryData | null;
  reports: ReportsData | null;
  statsLoading: boolean;
  summaryLoading: boolean;
  reportsLoading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useDashboardData(): DashboardState {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const abortController = new AbortController();

    // Tier 1: Fast counts (4 simple COUNT queries, cached 10 min)
    fetchJSON<QuickStats>('/api/dashboard/stats')
      .then(d => { if (mountedRef.current) { setStats(d); setStatsLoading(false); } })
      .catch(e => { if (mountedRef.current) { setStatsLoading(false); console.error(e); } });

    // Tier 2: Enquiries, batches, notices — medium queries
    fetchJSON<SummaryData>('/api/dashboard/summary')
      .then(d => { if (mountedRef.current) { setSummary(d); setSummaryLoading(false); } })
      .catch(e => { if (mountedRef.current) { setSummaryLoading(false); console.error(e); } });

    // Tier 3: Heavy reports — annual targets + placement
    fetchJSON<ReportsData>('/api/dashboard/reports')
      .then(d => { if (mountedRef.current) { setReports(d); setReportsLoading(false); } })
      .catch(e => { if (mountedRef.current) { setReportsLoading(false); setError(e.message); } });

    return () => {
      mountedRef.current = false;
      abortController.abort();
    };
  }, [fetchCount]);

  const refetch = () => setFetchCount(c => c + 1);

  return { stats, summary, reports, statsLoading, summaryLoading, reportsLoading, error, refetch };
}
