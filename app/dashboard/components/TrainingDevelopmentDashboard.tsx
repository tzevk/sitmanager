/* eslint-disable @typescript-eslint/no-explicit-any */
import { TableSkeleton, WidgetSkeleton } from './Skeletons';
import { toBatchNumber } from '@/lib/batch-display';

function pctTone(value: number) {
  if (value >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (value >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

export default function TrainingDevelopmentDashboard({ data, loading }: { data: any; loading: boolean }) {
  const td = data?.trainingDevelopment ?? {};

  const ongoing = td.ongoingBatches ?? [];
  const lowAttendance = td.lowAttendanceStudents ?? [];
  const lowPerformance = td.lowPerformingStudents ?? [];
  const upcomingExams = td.upcomingExams ?? [];
  const finishedExams = td.finishedExams ?? [];
  const todaysLectures = td.todaysLectures ?? [];
  const googlePending = Number(td.googleReviewsPending ?? 0);
  const upcomingConvocations = td.upcomingConvocations ?? [];
  const siteVisits = td.siteVisits ?? [];
  const admissionCancelled = td.admissionCancelled ?? [];

  return (
    <div className="space-y-6 pb-8">
      {/* 1) Ongoing Batches */}
      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Ongoing Batches</div>
          <div className="overflow-auto max-h-[340px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3">Batch no.</th>
                  <th className="text-left px-4 py-3">Training Program Name</th>
                  <th className="text-center px-4 py-3">% Complete</th>
                  <th className="text-center px-4 py-3">Total Students</th>
                  <th className="text-center px-4 py-3">Avg. Attendance %</th>
                  <th className="text-center px-4 py-3">Avg. Marks %</th>
                  <th className="text-center px-4 py-3">Low-Performing Students</th>
                </tr>
              </thead>
              <tbody>
                {ongoing.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={7}>No ongoing batch data</td></tr>
                ) : ongoing.map((r: any, i: number) => (
                  <tr key={`${r.Batch_Id || i}`} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold">{toBatchNumber(r.batch_no)}</td>
                    <td className="px-4 py-3">{r.training_program || '-'}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(Number(r.percentage_complete || 0))}`}>{pct(Number(r.percentage_complete || 0))}</span></td>
                    <td className="px-4 py-3 text-center">{r.total_students ?? 0}</td>
                    <td className="px-4 py-3 text-center">{r.avg_attendance_pct ?? 0}%</td>
                    <td className="px-4 py-3 text-center">{r.avg_marks_pct ?? 0}%</td>
                    <td className="px-4 py-3 text-center">{r.low_performing_students ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2) Low Attendance Students */}
        {loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Low Attendance Students</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Batch No.</th>
                    <th className="text-left px-4 py-3">Training Program</th>
                    <th className="text-center px-4 py-3">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {lowAttendance.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={4}>No low attendance records</td></tr> :
                    lowAttendance.map((r: any, i: number) => (
                      <tr key={`${r.name || i}-${r.batch_no || ''}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">{r.name || '-'}</td>
                        <td className="px-4 py-3">{toBatchNumber(r.batch_no)}</td>
                        <td className="px-4 py-3">{r.training_program || '-'}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(Number(r.attendance_pct || 0))}`}>{pct(Number(r.attendance_pct || 0))}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3) Low Performing Students */}
        {loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Low Performing Students</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Batch No.</th>
                    <th className="text-left px-4 py-3">Training Program</th>
                    <th className="text-center px-4 py-3">Marks %</th>
                  </tr>
                </thead>
                <tbody>
                  {lowPerformance.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={4}>No low performance records</td></tr> :
                    lowPerformance.map((r: any, i: number) => (
                      <tr key={`${r.name || i}-${r.batch_no || ''}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">{r.name || '-'}</td>
                        <td className="px-4 py-3">{toBatchNumber(r.batch_no)}</td>
                        <td className="px-4 py-3">{r.training_program || '-'}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(Number(r.marks_pct || 0))}`}>{pct(Number(r.marks_pct || 0))}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 4) Upcoming Exams */}
        {loading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Upcoming Exams</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Batch Number</th>
                    <th className="text-left px-4 py-3">Training Program</th>
                    <th className="text-center px-4 py-3">Date of Exam</th>
                    <th className="text-center px-4 py-3">Status of Paper</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingExams.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={4}>No upcoming exams</td></tr> :
                    upcomingExams.map((r: any, i: number) => (
                      <tr key={`${r.batch_no || i}-${r.exam_date || ''}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">{toBatchNumber(r.batch_no)}</td>
                        <td className="px-4 py-3">{r.training_program || '-'}</td>
                        <td className="px-4 py-3 text-center">{r.exam_date ? new Date(r.exam_date).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="px-4 py-3 text-center">{r.paper_status || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5) Finished Exams */}
        {loading ? <TableSkeleton rows={5} cols={5} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Finished Exams</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Batch Number</th>
                    <th className="text-left px-4 py-3">Training Program</th>
                    <th className="text-center px-4 py-3">Date of Exam</th>
                    <th className="text-center px-4 py-3">Status of Paper</th>
                    <th className="text-center px-4 py-3">Average Marks %</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedExams.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={5}>No finished exams</td></tr> :
                    finishedExams.map((r: any, i: number) => (
                      <tr key={`${r.batch_no || i}-${r.exam_date || ''}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">{toBatchNumber(r.batch_no)}</td>
                        <td className="px-4 py-3">{r.training_program || '-'}</td>
                        <td className="px-4 py-3 text-center">{r.exam_date ? new Date(r.exam_date).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="px-4 py-3 text-center">{r.paper_status || '-'}</td>
                        <td className="px-4 py-3 text-center">{r.average_marks_pct ?? 0}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6) Today's Lectures */}
        {loading ? <TableSkeleton rows={5} cols={5} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Today&apos;s Lectures</div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Batch no.</th>
                    <th className="text-left px-4 py-3">Training Program</th>
                    <th className="text-left px-4 py-3">Lecture Topic</th>
                    <th className="text-center px-4 py-3">Room No</th>
                    <th className="text-left px-4 py-3">Trainer</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysLectures.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-400" colSpan={5}>No lectures scheduled today</td></tr> :
                    todaysLectures.map((r: any, i: number) => (
                      <tr key={`${r.batch_no || i}-${r.lecture_topic || ''}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">{toBatchNumber(r.batch_no)}</td>
                        <td className="px-4 py-3">{r.training_program || '-'}</td>
                        <td className="px-4 py-3">{r.lecture_topic || '-'}</td>
                        <td className="px-4 py-3 text-center">{r.room_no || '-'}</td>
                        <td className="px-4 py-3">{r.trainer || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7) Google Reviews Pending */}
        {loading ? <WidgetSkeleton lines={2} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Google Reviews Pending</div>
            <div className="p-6 flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl font-black text-[#2E3093]">{googlePending}</p>
                <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">Students pending review</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 8) Upcoming Convocations */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Upcoming Convocations</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {upcomingConvocations.length === 0 ? <p className="text-sm text-gray-400">No upcoming convocations</p> :
                upcomingConvocations.map((r: any, i: number) => (
                  <div key={`${r.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                    <div className="font-semibold text-gray-800">{r.batch_list || 'Batch list not set'}</div>
                    <div className="text-xs text-gray-500 mt-1">{r.convocation_date ? new Date(r.convocation_date).toLocaleDateString('en-IN') : '-'}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 9) Site Visits */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Site Visits</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {siteVisits.length === 0 ? <p className="text-sm text-gray-400">No site visits records</p> :
                siteVisits.map((r: any, i: number) => (
                  <div key={`${r.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                    <div className="font-semibold text-gray-800">{toBatchNumber(r.batch_no)} · {r.training_program || '-'}</div>
                    <div className="text-xs text-gray-500 mt-1">{r.location || r.region || '-'} · {r.visit_date ? new Date(r.visit_date).toLocaleDateString('en-IN') : '-'}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 10) Admission Cancelled */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Admission Cancelled</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {admissionCancelled.length === 0 ? <p className="text-sm text-gray-400">No cancelled admissions</p> :
                admissionCancelled.map((r: any, i: number) => (
                  <div key={`${r.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                    <div className="font-semibold text-gray-800">{r.student_name || '-'}</div>
                    <div className="text-xs text-gray-500 mt-1">{toBatchNumber(r.batch_no)} · {r.training_program || '-'}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
