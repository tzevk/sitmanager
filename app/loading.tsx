export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 border-4 border-gray-200 rounded-full" />
          <div className="w-10 h-10 border-4 border-[#2E3093] border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-[#FAE452]">SIT</span>
          <span className="text-base font-bold text-[#2E3093]">Manager</span>
        </div>
      </div>
    </div>
  );
}
