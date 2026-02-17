export default function NoticeBoard() {
  const notices = [
    { title: 'Holiday on Feb 19 - Shivaji Jayanti', priority: 'info' },
    { title: 'Fee submission deadline extended to Feb 28', priority: 'warning' },
    { title: 'Annual sports day registration open', priority: 'info' },
  ];

  const priorityStyles: Record<string, string> = {
    info: 'border-l-[#2A6BB5] bg-[#2A6BB5]/5',
    warning: 'border-l-[#FAE452] bg-[#FAE452]/10',
  };

  return (
    <div className="col-span-2 row-span-1 rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Notice Board</h3>
      <div className="space-y-2">
        {notices.map((notice, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-l-4 ${priorityStyles[notice.priority]}`}
          >
            <p className="text-sm font-medium text-gray-700">{notice.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
