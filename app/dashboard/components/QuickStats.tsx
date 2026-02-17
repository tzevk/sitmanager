export default function QuickStats() {
  const stats = [
    { label: 'New Admissions', value: '32', change: '+12%', up: true },
    { label: 'Attendance Today', value: '94%', change: '+2%', up: true },
    { label: 'Pending Fees', value: '₹2.4L', change: '-8%', up: false },
    { label: 'Placements', value: '87%', change: '+5%', up: true },
  ];

  return (
    <div className="col-span-1 row-span-1 rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Stats</h3>
      <div className="space-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="text-lg font-bold text-[#2E3093]">{stat.value}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                stat.up
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {stat.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
