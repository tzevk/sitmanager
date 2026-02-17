export default function DepartmentOverview() {
  const departments = [
    { name: 'Career Building', students: 320, color: 'from-[#2E3093] to-[#2A6BB5]' },
    { name: 'Corporate Training', students: 280, color: 'from-[#2A6BB5] to-[#2E3093]' },
    { name: 'Training & Dev', students: 410, color: 'from-[#2E3093] to-[#2A6BB5]' },
    { name: 'Accounts', students: 230, color: 'from-[#2A6BB5] to-[#2E3093]' },
  ];

  const maxStudents = Math.max(...departments.map((d) => d.students));

  return (
    <div className="col-span-1 row-span-1 rounded-2xl bg-white border border-gray-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Departments</h3>
      <div className="space-y-3">
        {departments.map((dept) => (
          <div key={dept.name}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-600">{dept.name}</span>
              <span className="text-xs font-bold text-[#2E3093]">{dept.students}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${dept.color}`}
                style={{ width: `${(dept.students / maxStudents) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
