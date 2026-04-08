'use client';

import { TableSkeleton } from './Skeletons';

type PlacementData = {
  placementDepartment?: {
    placementSummary?: Array<{ metric?: string; value?: number }>;
    upcomingInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    completedInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    jobOpeningTracker?: Array<{ company_name?: string; designation?: string; location?: string; application_deadline?: string; status?: string; total_applications?: number }>;
    companyVisitsPlanned?: Array<{ visit_date?: string; region?: string; location?: string; training_name?: string; batch_code?: string }>;
    campusInterviewsPlanned?: Array<{ company_name?: string; profile?: string; training_name?: string; batch_code?: string; posted_date?: string }>;
    upcomingMockInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
    completedMockInterviews?: Array<{ interview_date?: string; company_name?: string; training_name?: string; batch_code?: string }>;
  };
};

function WidgetCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold flex items-center justify-between gap-3">
        <h3 className="text-sm tracking-wide">{title}</h3>
        <div>
          {typeof count === 'number' && (
            <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md font-semibold whitespace-nowrap">
              {count.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="p-0 overflow-auto max-h-[360px]">{children}</div>
    </div>
  );
}

function EmptyState({ text = 'No data available' }: { text?: string }) {
  return <div className="p-6 text-sm text-center text-gray-500">{text}</div>;
}

function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
        <tr>
          {columns.map((col) => (
            <th key={col} className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{rows}</tbody>
    </table>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#2E3093]">{value.toLocaleString()}</p>
    </div>
  );
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('open')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('completed')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (s.includes('closed')) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function PlacementDepartmentDashboard({ data, loading }: { data: PlacementData; loading: boolean }) {
  const placementData = data?.placementDepartment ?? {};

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <TableSkeleton key={i} rows={5} cols={4} />
        ))}
      </div>
    );
  }

  const summaryRows = placementData.placementSummary ?? [];
  const upcomingInterviews = placementData.upcomingInterviews ?? [];
  const completedInterviews = placementData.completedInterviews ?? [];
  const jobOpeningTracker = placementData.jobOpeningTracker ?? [];
  const companyVisitsPlanned = placementData.companyVisitsPlanned ?? [];
  const campusInterviewsPlanned = placementData.campusInterviewsPlanned ?? [];
  const upcomingMockInterviews = placementData.upcomingMockInterviews ?? [];
  const completedMockInterviews = placementData.completedMockInterviews ?? [];
  const summaryMap: Record<string, number> = Object.fromEntries(
    summaryRows.map((r) => [String(r.metric || '').trim(), Number(r.value || 0)])
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold flex items-center justify-between gap-3">
          <span>Placement Department</span>
          <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md">Real Time</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="px-4 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:col-span-4">
          <StatTile label="Passed Students" value={summaryMap['Total Passed Students'] ?? 0} />
          <StatTile label="Placed Students" value={summaryMap['Total Placed Students'] ?? 0} />
          <StatTile label="Open Jobs" value={summaryMap['Open Job Openings'] ?? 0} />
          <StatTile label="Upcoming Interviews" value={summaryMap['Upcoming Interviews'] ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <WidgetCard title="Placement Summary" count={summaryRows.length}>
          {summaryRows.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Metric', 'Value']}
              rows={summaryRows.map((r, idx) => (
                <tr key={`${r.metric}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.metric || '-'}</td>
                  <td className="px-4 py-3 text-[#2E3093] font-semibold">{Number(r.value || 0).toLocaleString()}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Upcoming Interviews" count={upcomingInterviews.length}>
          {upcomingInterviews.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Date', 'Company', 'Training Name', 'Batch']}
              rows={upcomingInterviews.map((r, idx) => (
                <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Completed Interviews" count={completedInterviews.length}>
          {completedInterviews.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Date', 'Company', 'Training Name', 'Batch']}
              rows={completedInterviews.map((r, idx) => (
                <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Job Opening Tracker" count={jobOpeningTracker.length}>
          {jobOpeningTracker.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Company', 'Designation', 'Location', 'Deadline', 'Status', 'Applications']}
              rows={jobOpeningTracker.map((r, idx) => (
                <tr key={`${r.company_name}-${r.designation}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.designation || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.location || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.application_deadline || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(r.status || '-')}`}>
                      {r.status || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#2E3093]">{Number(r.total_applications || 0).toLocaleString()}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Company Visits Planned" count={companyVisitsPlanned.length}>
          {companyVisitsPlanned.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Date', 'Region', 'Location', 'Training Name', 'Batch']}
              rows={companyVisitsPlanned.map((r, idx) => (
                <tr key={`${r.visit_date}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.visit_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.region || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.location || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Campus Interviews Planned" count={campusInterviewsPlanned.length}>
          {campusInterviewsPlanned.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Company', 'Profile', 'Training Name', 'Batch', 'Posted Date']}
              rows={campusInterviewsPlanned.map((r, idx) => (
                <tr key={`${r.company_name}-${r.profile}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.profile || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.posted_date || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Upcoming Mock Interviews" count={upcomingMockInterviews.length}>
          {upcomingMockInterviews.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Date', 'Company', 'Training Name', 'Batch']}
              rows={upcomingMockInterviews.map((r, idx) => (
                <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>

        <WidgetCard title="Completed Mock Interviews" count={completedMockInterviews.length}>
          {completedMockInterviews.length === 0 ? (
            <EmptyState />
          ) : (
            <Table
              columns={['Date', 'Company', 'Training Name', 'Batch']}
              rows={completedMockInterviews.map((r, idx) => (
                <tr key={`${r.company_name}-${r.batch_code}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.interview_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.training_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.batch_code || '-'}</td>
                </tr>
              ))}
            />
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
