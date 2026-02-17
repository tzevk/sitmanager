export default function WelcomeCard() {
  return (
    <div className="col-span-2 row-span-1 rounded-2xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] p-6 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#FAE452]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

      <div className="relative z-10">
        <p className="text-white/70 text-sm font-medium">Welcome back,</p>
        <h2 className="text-2xl font-bold mt-1">Super Admin</h2>
        <p className="text-white/60 text-sm mt-2">
          Here&apos;s what&apos;s happening at SIT today.
        </p>
      </div>

      <div className="relative z-10 mt-4 flex gap-6">
        <div>
          <p className="text-2xl font-bold text-[#FAE452]">1,240</p>
          <p className="text-white/60 text-xs mt-0.5">Total Students</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#FAE452]">48</p>
          <p className="text-white/60 text-xs mt-0.5">Active Courses</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#FAE452]">126</p>
          <p className="text-white/60 text-xs mt-0.5">Faculty</p>
        </div>
      </div>
    </div>
  );
}
