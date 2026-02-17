import {
  QuickStatsSkeleton,
  TableSkeleton,
  WidgetSkeleton,
  UpcomingBatchesSkeleton,
  EnquirySkeleton,
} from './components/Skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <QuickStatsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <TableSkeleton rows={6} cols={10} className="lg:col-span-3" />
        <WidgetSkeleton lines={4} />
        <UpcomingBatchesSkeleton />
        <WidgetSkeleton lines={3} />
        <EnquirySkeleton />
        <TableSkeleton rows={5} cols={11} className="lg:col-span-3" />
        <WidgetSkeleton lines={3} />
      </div>
    </div>
  );
}
