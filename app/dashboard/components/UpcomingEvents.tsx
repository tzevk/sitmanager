export default function UpcomingEvents() {
  const events = [
    { title: 'Batch A-15 Orientation', date: 'Feb 12', time: '10:00 AM', tag: 'Event' },
    { title: 'Faculty Meeting', date: 'Feb 13', time: '2:00 PM', tag: 'Meeting' },
    { title: 'Placement Drive - TCS', date: 'Feb 15', time: '9:00 AM', tag: 'Placement' },
    { title: 'Mid-term Exam', date: 'Feb 18', time: '11:00 AM', tag: 'Exam' },
  ];

  const tagColors: Record<string, string> = {
    Event: 'bg-[#2A6BB5]/10 text-[#2A6BB5]',
    Meeting: 'bg-[#FAE452]/20 text-[#2E3093]',
    Placement: 'bg-green-50 text-green-600',
    Exam: 'bg-red-50 text-red-600',
  };

  return (
    <div className="col-span-1 row-span-1 rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="text-center shrink-0 w-11">
              <p className="text-lg font-bold text-[#2E3093] leading-tight">{event.date.split(' ')[1]}</p>
              <p className="text-[10px] text-gray-400 uppercase">{event.date.split(' ')[0]}</p>
            </div>
            <div className="min-w-0 flex-1 border-l-2 border-gray-100 pl-3">
              <p className="text-sm font-medium text-gray-800 truncate">{event.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400">{event.time}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tagColors[event.tag]}`}>
                  {event.tag}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
