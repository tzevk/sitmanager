export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[#2E3093]/20 rounded-full" />
          <div className="w-12 h-12 border-4 border-[#2E3093] border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Loading dashboard...</p>
      </div>
    </div>
  );
}
