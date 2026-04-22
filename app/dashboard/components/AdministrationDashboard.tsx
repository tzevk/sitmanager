/* eslint-disable @typescript-eslint/no-explicit-any */
import { TableSkeleton, WidgetSkeleton } from './Skeletons';
import { toBatchNumber } from '@/lib/batch-display';


interface AdminTodoItem {
  id: string;
  taskName: string;
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Done';
}

function parseDateLoose(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw === '-' || raw === '00:00.0') return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const dmyDash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) return new Date(`${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`);

  const dmySlash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlash) return new Date(`${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`);

  return null;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function nextSundays(count = 4) {
  const out: Array<{ title: string; date: string; type: string }> = [];
  const d = new Date();
  for (let i = 0; i < 60 && out.length < count; i += 1) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) {
      out.push({
        title: 'Weekly Off',
        date: d.toLocaleDateString('en-IN'),
        type: 'Weekly Offs',
      });
    }
  }
  return out;
}

export default function AdministrationDashboard({
  data,
  loading,
  todos,
  onAddTodo,
  onUpdateTodo,
  onRemoveTodo,
}: {
  data: any;
  loading: boolean;
  todos: AdminTodoItem[];
  onAddTodo: (taskName: string, priority: AdminTodoItem['priority'], dueDate: string) => void;
  onUpdateTodo: (id: string, patch: Partial<AdminTodoItem>) => void;
  onRemoveTodo: (id: string) => void;
}) {
  const today = new Date();

  const pendingFollowups = data?.pendingFollowups ?? [];
  const followUpsToday = pendingFollowups.filter((f: any) => {
    const dt = parseDateLoose(f?.next_followup_date);
    return dt ? sameDay(dt, today) : false;
  });

  const lecturesToday = data?.trainingDevelopment?.todaysLectures ?? [];
  const meetings = data?.adminDashboard?.meetings ?? [];
  const weeklyReport = data?.adminDashboard?.weeklyReport ?? [];

  const calendarEvents = [
    ...(data?.trainingDevelopment?.upcomingConvocations ?? []).slice(0, 5).map((r: any) => ({
      type: 'Convocation',
      title: r.batch_list || 'Convocation',
      date: r.convocation_date ? new Date(r.convocation_date).toLocaleDateString('en-IN') : '-',
    })),
    ...(data?.trainingDevelopment?.upcomingExams ?? []).slice(0, 5).map((r: any) => ({
      type: 'Exams',
      title: `${r.training_program || 'Exam'} (${toBatchNumber(r.batch_no)})`,
      date: r.exam_date ? new Date(r.exam_date).toLocaleDateString('en-IN') : '-',
    })),
    ...(data?.trainingDevelopment?.siteVisits ?? []).slice(0, 5).map((r: any) => ({
      type: 'Site Visits',
      title: `${r.training_program || 'Visit'} - ${r.location || '-'}`,
      date: r.visit_date ? new Date(r.visit_date).toLocaleDateString('en-IN') : '-',
    })),
    ...followUpsToday.slice(0, 5).map((r: any) => ({
      type: 'Follow Ups',
      title: r.name || 'Follow up',
      date: 'Today',
    })),
    ...lecturesToday.slice(0, 5).map((r: any) => ({
      type: 'Lectures',
      title: `${r.training_program || 'Lecture'} (${toBatchNumber(r.batch_no)})`,
      date: 'Today',
    })),
    ...todos.slice(0, 5).map((t) => ({
      type: 'To-Do List',
      title: t.taskName,
      date: t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '-',
    })),
    ...meetings.slice(0, 5).map((m: any) => ({
      type: 'Corporate Meetings',
      title: m.title || 'Meeting',
      date: m.meeting_date || '-',
    })),
    ...nextSundays(4),
    { type: 'Birthdays', title: 'No records', date: '-' },
    { type: 'Assignment Due Date', title: 'No records', date: '-' },
    { type: 'Mock Interviews', title: 'No records', date: '-' },
    { type: 'Feedback Collection Dates', title: 'No records', date: '-' },
    { type: 'Holidays', title: 'No records', date: '-' },
    { type: 'Interviews', title: 'No records', date: '-' },
  ];

  const deptPerf = [
    { label: 'Enquiries (30d)', value: Number(data?.enquiryReport?.summary?.last_30_days || 0) },
    { label: 'Admissions (Funnel)', value: Number(data?.leadFunnel?.converted || 0) },
    { label: 'Active Batches', value: Number(data?.quickStats?.activeBatches || 0) },
    { label: 'Placement Reqs', value: Number(data?.placementReport?.activeRequirements || 0) },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Department switching is handled in the main dashboard profile header */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">To Do List</div>
            <div className="p-4 border-b border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-2">
              <input id="admin-task" className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Task Name" />
              <select id="admin-priority" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" defaultValue="Medium">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <input id="admin-due" type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button
                className="bg-[#2E3093] text-white text-sm rounded-lg px-3 py-2 font-semibold"
                onClick={() => {
                  const task = (document.getElementById('admin-task') as HTMLInputElement | null)?.value || '';
                  const priority = ((document.getElementById('admin-priority') as HTMLSelectElement | null)?.value || 'Medium') as AdminTodoItem['priority'];
                  const due = (document.getElementById('admin-due') as HTMLInputElement | null)?.value || '';
                  onAddTodo(task, priority, due);
                  if (document.getElementById('admin-task')) (document.getElementById('admin-task') as HTMLInputElement).value = '';
                }}
              >
                Add Task
              </button>
            </div>
            <div className="overflow-auto max-h-[320px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Task Name</th>
                    <th className="text-center px-4 py-3">Priority</th>
                    <th className="text-center px-4 py-3">Due Date</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.length === 0 ? (
                    <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={5}>No tasks available</td></tr>
                  ) : todos.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">{t.taskName}</td>
                      <td className="px-4 py-3 text-center">{t.priority}</td>
                      <td className="px-4 py-3 text-center">{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={t.status}
                          onChange={(e) => onUpdateTodo(t.id, { status: e.target.value as AdminTodoItem['status'] })}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Done</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-rose-600 text-xs font-semibold" onClick={() => onRemoveTodo(t.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? <WidgetSkeleton lines={8} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Calendar</div>
            <div className="p-4 space-y-2 max-h-[420px] overflow-auto">
              {calendarEvents.length === 0 ? (
                <p className="text-sm text-gray-400">No calendar events available</p>
              ) : calendarEvents.map((e, i) => (
                <div key={`${e.type}-${i}`} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#2E3093] font-bold">{e.type}</p>
                    <p className="text-sm font-medium text-gray-800">{e.title}</p>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">{e.date}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Follow Ups Today</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {followUpsToday.length === 0 ? <p className="text-sm text-gray-400">No follow ups today</p> : followUpsToday.map((f: any, i: number) => (
                <div key={`${f.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <p className="font-semibold text-gray-800">{f.name || '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">{f.next_followup_date || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Lectures Scheduled Today</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {lecturesToday.length === 0 ? <p className="text-sm text-gray-400">No lectures scheduled today</p> : lecturesToday.map((l: any, i: number) => (
                <div key={`${l.batch_no || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <p className="font-semibold text-gray-800">{l.training_program || '-'} ({toBatchNumber(l.batch_no)})</p>
                  <p className="text-xs text-gray-500 mt-1">{l.lecture_topic || '-'} · Room {l.room_no || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Meetings</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {meetings.length === 0 ? <p className="text-sm text-gray-400">No meetings found</p> : meetings.map((m: any, i: number) => (
                <div key={`${m.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <p className="font-semibold text-gray-800">{m.title || '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">{m.meeting_date || '-'} · {m.purpose || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? <WidgetSkeleton lines={5} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Department Performance</div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {deptPerf.map((p) => (
                <div key={p.label} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">{p.label}</p>
                  <p className="text-2xl font-black text-[#2E3093] mt-1">{p.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? <WidgetSkeleton lines={5} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Weekly Report</div>
            <div className="p-4 space-y-2">
              {weeklyReport.length === 0 ? <p className="text-sm text-gray-400">No weekly report data</p> : weeklyReport.map((w: any, i: number) => (
                <div key={`${w.metric || i}`} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <span className="font-medium text-gray-700">{w.metric || '-'}</span>
                  <span className="font-bold text-[#2E3093]">{Number(w.value || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
