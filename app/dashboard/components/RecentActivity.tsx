export default function RecentActivity() {
  const activities = [
    { action: 'New student enrolled', name: 'Priya Sharma', time: '2 min ago', color: 'bg-[#2A6BB5]' },
    { action: 'Fee payment received', name: 'Rahul Patil', time: '15 min ago', color: 'bg-green-500' },
    { action: 'Assignment submitted', name: 'Batch A-12', time: '1 hr ago', color: 'bg-[#FAE452]' },
    { action: 'Faculty leave request', name: 'Dr. Mehta', time: '2 hr ago', color: 'bg-orange-400' },
    { action: 'Course updated', name: 'Advanced Java', time: '3 hr ago', color: 'bg-[#2E3093]' },
  ];

  return (
    <div className="col-span-1 row-span-2 rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${activity.color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{activity.action}</p>
              <p className="text-xs text-gray-400 mt-0.5">{activity.name} &middot; {activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
