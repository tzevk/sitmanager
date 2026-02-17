/* Skeleton UI components for progressive dashboard loading */

/** Shimmer bar — fill its parent and pulse */
export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded ${className}`}
      style={{ backgroundSize: '200% 100%' }}
    />
  );
}

/** Stat card skeleton matching QuickStats layout */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <Shimmer className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-7 w-16" />
      </div>
    </div>
  );
}

export function QuickStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Generic widget skeleton with header + body */
export function WidgetSkeleton({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
        <Shimmer className="h-4 w-32" />
        <div className="ml-auto">
          <Shimmer className="h-5 w-12 rounded-full" />
        </div>
      </div>
      {/* Body rows */}
      <div className="p-4 space-y-3 flex-1">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3 w-full max-w-[200px]" />
              <Shimmer className="h-2.5 w-full max-w-[140px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Table skeleton for Annual Targets / Placement */
export function TableSkeleton({ rows = 5, cols = 8, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
        <Shimmer className="h-4 w-40" />
        <div className="ml-auto">
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
      </div>
      {/* Table header */}
      <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Table rows */}
      <div className="p-4 space-y-2.5 flex-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2">
            {Array.from({ length: cols }).map((_, j) => (
              <Shimmer key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Batch card skeleton for Upcoming Batches */
export function BatchCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 p-3.5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 space-y-1.5">
          <Shimmer className="h-3.5 w-32" />
          <Shimmer className="h-2.5 w-24" />
        </div>
        <Shimmer className="h-6 w-16 rounded-lg" />
      </div>
      <div className="flex gap-3 mt-2">
        <Shimmer className="h-2.5 w-16" />
        <Shimmer className="h-2.5 w-12" />
        <Shimmer className="h-2.5 w-20" />
      </div>
    </div>
  );
}

export function UpcomingBatchesSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col lg:col-span-2">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
        <Shimmer className="h-4 w-36" />
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <BatchCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Enquiry report skeleton */
export function EnquirySkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
        <Shimmer className="h-4 w-32" />
      </div>
      <div className="p-4 flex-1">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 flex flex-col items-center gap-1.5">
              <Shimmer className="h-6 w-10" />
              <Shimmer className="h-2 w-12" />
            </div>
          ))}
        </div>
        <Shimmer className="h-2.5 w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
              <Shimmer className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-3 w-28" />
                <Shimmer className="h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
