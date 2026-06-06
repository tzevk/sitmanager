'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface Option {
  id: number;
  name: string;
}

type CorporateRecordStatus = 'Follow Up' | 'CV Send' | 'Candidate Shortlisted' | 'Candidate Placed';
type PeriodMode = 'range' | 'month' | 'year';
type FollowUpFilterMode = 'all' | 'due' | 'upcoming';

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

const PERIOD_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: 'range', label: 'Date Range' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly / Annual' },
];

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function CorporateRecordReportPage() {
  const router = useRouter();
  const { canView, canExport, loading: permLoading } = useResourcePermissions('report_corporate_record');

  const [companies, setCompanies] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilterMode>('all');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('range');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const status: CorporateRecordStatus = 'Follow Up';
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      try {
        const res = await fetch('/api/reports/corporate-record?options=filters');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load report filters');
        if (!cancelled) {
          setCompanies(Array.isArray(data.companies) ? data.companies : []);
          setCourses(Array.isArray(data.courses) ? data.courses : []);
          setPurposes(Array.isArray(data.purposes) ? data.purposes : []);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report filters');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const validationError = useMemo(() => {
    if (periodMode === 'range') {
      if (!fromDate) return 'From Date is required';
      if (!toDate) return 'To Date is required';
      if (fromDate > toDate) return 'From Date cannot be after To Date';
    }
    if (periodMode === 'month') {
      if (!month) return 'Month is required for monthly reports';
      if (!year) return 'Year is required for monthly reports';
    }
    if (periodMode === 'year' && !year) return 'Year is required for yearly reports';
    return '';
  }, [periodMode, fromDate, toDate, month, year]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, index) => String(currentYear + 2 - index));
  }, []);

  const handleExport = async () => {
    setError('');
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        companyId,
        courseId,
        purpose,
        followUpFilter,
        status,
        periodMode,
      });
      if (periodMode === 'range') {
        params.set('fromDate', fromDate);
        params.set('toDate', toDate);
      }
      if (periodMode === 'month') {
        params.set('month', month);
        params.set('year', year);
      }
      if (periodMode === 'year') {
        params.set('year', year);
      }
      const res = await fetch(`/api/reports/corporate-record?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate report');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] || `Corporate_Record_${Date.now()}.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setSubmitting(false);
    }
  };

  if (permLoading || loadingOptions) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the Corporate Record report." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corporate Record"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Corporate Record' }]}
        meta="Excel report generator"
        action={<>
          <GhostBtn onClick={() => router.back()}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </GhostBtn>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#24267A] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2E3093]"
          >
            {submitting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
              </svg>
            )}
            Excel
          </button>
        </>}
      />

      <FilterBar>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={`${ctrl} w-[220px]`}>
          <option value="all">All Companies</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>

        <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as PeriodMode)} className={`${ctrl} w-[150px]`}>
          {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        {periodMode === 'range' && (
          <>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From date" className={`${ctrl} w-[140px]`} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To date" className={`${ctrl} w-[140px]`} />
          </>
        )}

        {periodMode === 'month' && (
          <>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${ctrl} w-[140px]`}>
              <option value="">Month</option>
              {MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className={`${ctrl} w-[110px]`}>
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </>
        )}

        {periodMode === 'year' && (
          <select value={year} onChange={(e) => setYear(e.target.value)} className={`${ctrl} w-[110px]`}>
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        )}

        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${ctrl} w-[170px]`}>
          <option value="all">All Courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
        </select>

        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${ctrl} w-[170px]`}>
          <option value="all">All Purposes</option>
          {purposes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <select value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value as FollowUpFilterMode)} className={`${ctrl} w-[150px]`}>
          <option value="all">All Follow Ups</option>
          <option value="due">Due Follow Ups</option>
          <option value="upcoming">Upcoming Follow Ups</option>
        </select>
      </FilterBar>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}