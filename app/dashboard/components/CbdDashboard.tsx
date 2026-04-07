/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  QuickStatsSkeleton,
  TableSkeleton,
  WidgetSkeleton,
} from './Skeletons';

function pctTone(value: number) {
  if (value >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (value >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

export default function CbdDashboard({ data, loading }: { data: any; loading: boolean }) {
  const annualTargets = data?.annualTargets?.batchTargets ?? [];
  const upcomingBatches = (data?.upcomingBatches ?? []).filter((b: any) => {
    if (!b?.SDate) return false;
    const start = new Date(b.SDate);
    if (Number.isNaN(start.getTime())) return false;
    const now = new Date();
    const in3Months = new Date();
    in3Months.setMonth(in3Months.getMonth() + 3);
    return start >= now && start <= in3Months;
  });

  const leadSummary = data?.enquiryReport?.summary ?? {};
  const funnel = {
    total: Number(leadSummary.total_enquiries || 0),
    contacted: Number(data?.leadFunnel?.contacted || 0),
    interested: Number(data?.leadFunnel?.interested || 0),
    converted: Number(data?.leadFunnel?.converted || 0),
  };

  const sourceRows = data?.sourcePerformance ?? [];
  const seminarTargets = data?.seminarTargets ?? [];
  const pendingFollowups = data?.pendingFollowups ?? [];
  const dailyActivity = data?.dailyActivity ?? [];
  const pendingFees = data?.pendingFees ?? [];
  const alumniProgress = data?.alumniRegistration ?? [];

  return (
    <div className="space-y-6 pb-8">
      {/* 1) Annual Targets */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">
            Annual Targets
          </div>
          <div className="overflow-auto max-h-[340px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3">Training Program Name</th>
                  <th className="text-center px-4 py-3">Target Students</th>
                  <th className="text-center px-4 py-3">Students Admitted</th>
                  <th className="text-center px-4 py-3">Average Student per Batch</th>
                  <th className="text-center px-4 py-3">Percentage Achieved</th>
                </tr>
              </thead>
              <tbody>
                {annualTargets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-400" colSpan={5}>No annual targets available</td>
                  </tr>
                ) : (
                  annualTargets.map((row: any, i: number) => {
                    const minStu = parseInt(row.min_students_batch) || 15;
                    const targetFreq = Number(row.target_frequency) || 1;
                    const targetStudents = minStu * targetFreq;
                    const admitted = Number(row.students_admitted) || 0;
                    const avgPerBatch = targetFreq > 0 ? admitted / targetFreq : 0;
                    const achieved = targetStudents > 0 ? (admitted / targetStudents) * 100 : 0;
                    return (
                      <tr key={`${row.Course_Id || i}`} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-semibold text-gray-800">{row.CourseName || 'N/A'}</td>
                        <td className="px-4 py-3 text-center">{targetStudents}</td>
                        <td className="px-4 py-3 text-center">{admitted}</td>
                        <td className="px-4 py-3 text-center">{avgPerBatch.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold ${pctTone(achieved)}`}>
                            {pct(achieved)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2) Seminar Targets (Scrollable) */}
        {loading ? (
          <TableSkeleton rows={5} cols={4} className="lg:col-span-2" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">
              Seminar Targets
            </div>
            <div className="overflow-auto max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Month</th>
                    <th className="text-left px-4 py-3">College Names</th>
                    <th className="text-center px-4 py-3">Date</th>
                    <th className="text-center px-4 py-3">Annual Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {seminarTargets.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-400" colSpan={4}>No seminar target records available</td>
                    </tr>
                  ) : (
                    seminarTargets.map((row: any, i: number) => {
                      const annualPct = Number(row.annual_percentage || 0);
                      return (
                        <tr key={`${row.id || i}`} className="border-t border-gray-100">
                          <td className="px-4 py-3">{row.month || '-'}</td>
                          <td className="px-4 py-3 font-medium">{row.college_name || '-'}</td>
                          <td className="px-4 py-3 text-center">{row.date || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold ${pctTone(annualPct)}`}>
                              {pct(annualPct)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3) Exhibition Targets */}
        {loading ? (
          <WidgetSkeleton lines={3} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Exhibition Targets</div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Planned</span><span className="font-semibold">{data?.exhibitionTargets?.planned ?? 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Completed</span><span className="font-semibold">{data?.exhibitionTargets?.completed ?? 0}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Achievement</span>
                <span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(Number(data?.exhibitionTargets?.achievement_pct || 0))}`}>
                  {pct(Number(data?.exhibitionTargets?.achievement_pct || 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4) Upcoming Batches (next 3 months) */}
      {loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Upcoming Batches (next 3 months)</div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3">Batch number</th>
                  <th className="text-left px-4 py-3">Training Program Name</th>
                  <th className="text-center px-4 py-3">Enquiries Received</th>
                  <th className="text-center px-4 py-3">Enquiries Contacted</th>
                  <th className="text-center px-4 py-3">Interested Students</th>
                  <th className="text-center px-4 py-3">Confirmed Admissions</th>
                  <th className="text-center px-4 py-3">% Filled</th>
                </tr>
              </thead>
              <tbody>
                {upcomingBatches.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-400" colSpan={7}>No upcoming batches found for next 3 months</td>
                  </tr>
                ) : (
                  upcomingBatches.map((b: any, i: number) => {
                    const confirmed = Number(b.NoStudent || 0);
                    const max = Number(b.Max_Students || 0);
                    const fillPct = max > 0 ? (confirmed / max) * 100 : 0;
                    return (
                      <tr key={`${b.Batch_Id || i}`} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-semibold">{b.Batch_code || '-'}</td>
                        <td className="px-4 py-3">{b.CourseName || '-'}</td>
                        <td className="px-4 py-3 text-center">{b.Enquiries_Received ?? 0}</td>
                        <td className="px-4 py-3 text-center">{b.Enquiries_Contacted ?? 0}</td>
                        <td className="px-4 py-3 text-center">{b.Interested_Students ?? 0}</td>
                        <td className="px-4 py-3 text-center">{confirmed}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold ${pctTone(fillPct)}`}>
                            {pct(fillPct)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5) Pending Followups */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Pending Followups</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {pendingFollowups.length === 0 ? (
                <p className="text-sm text-gray-400">No pending followups</p>
              ) : pendingFollowups.map((f: any, i: number) => (
                <div key={`${f.id || i}`} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <div className="font-semibold text-gray-800 truncate">{f.name || f.student_name || 'Followup'}</div>
                  <div className="text-gray-500 text-xs mt-1">{f.next_followup_date || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6) Daily Activity Tracker (time filter) */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold flex items-center justify-between">
              <span>Daily Activity Tracker</span>
              <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md">Time Filter</span>
            </div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {dailyActivity.length === 0 ? (
                <p className="text-sm text-gray-400">No daily activity data available</p>
              ) : dailyActivity.map((a: any, i: number) => (
                <div key={`${a.id || i}`} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <span className="font-medium text-gray-700">{a.label || a.activity || '-'}</span>
                  <span className="font-bold text-[#2E3093]">{a.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7) Source Wise Performance (time filter) */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold flex items-center justify-between">
              <span>Source Wise Performance</span>
              <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md">Time Filter</span>
            </div>
            <div className="p-4 overflow-auto max-h-[260px]">
              {sourceRows.length === 0 ? (
                <p className="text-sm text-gray-400">No source-wise data available</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="text-left py-2">Source</th>
                      <th className="text-center py-2">Leads</th>
                      <th className="text-center py-2">Admissions</th>
                      <th className="text-center py-2">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((r: any, i: number) => {
                      const conv = Number(r.conversion_pct || 0);
                      return (
                        <tr key={`${r.source || i}`} className="border-t border-gray-100">
                          <td className="py-2">{r.source || '-'}</td>
                          <td className="py-2 text-center">{r.leads ?? 0}</td>
                          <td className="py-2 text-center">{r.admissions ?? 0}</td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(conv)}`}>{pct(conv)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 8) Total Lead Funnel Summary (time filter) */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold flex items-center justify-between">
              <span>Total Lead Funnel Summary</span>
              <span className="text-[11px] bg-white/20 px-2 py-1 rounded-md">Time Filter</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3 text-center"><p className="text-xs text-gray-500">Total Enquiries</p><p className="text-xl font-bold text-[#2E3093]">{funnel.total}</p></div>
              <div className="rounded-xl border border-gray-100 p-3 text-center"><p className="text-xs text-gray-500">Contacted</p><p className="text-xl font-bold text-[#2E3093]">{funnel.contacted}</p></div>
              <div className="rounded-xl border border-gray-100 p-3 text-center"><p className="text-xs text-gray-500">Interested</p><p className="text-xl font-bold text-[#2E3093]">{funnel.interested}</p></div>
              <div className="rounded-xl border border-gray-100 p-3 text-center"><p className="text-xs text-gray-500">Converted</p><p className="text-xl font-bold text-[#2E3093]">{funnel.converted}</p></div>
            </div>
          </div>
        )}

        {/* 9) Pending Fees */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold">Pending Fees</div>
            <div className="p-4 space-y-2 max-h-[260px] overflow-auto">
              {pendingFees.length === 0 ? (
                <p className="text-sm text-gray-400">No pending fees records available</p>
              ) : pendingFees.map((f: any, i: number) => (
                <div key={`${f.id || i}`} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-sm">
                  <span className="truncate max-w-[65%]">{f.student_name || f.name || 'Student'}</span>
                  <span className="font-bold text-[#2E3093]">{f.amount ? `Rs ${Number(f.amount).toLocaleString('en-IN')}` : '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10) Alumni Registration Progress */}
        {loading ? <WidgetSkeleton lines={4} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#2A6BB5] to-[#2E3093] text-white font-bold">Alumni Registration Progress</div>
            <div className="p-4 overflow-auto max-h-[260px]">
              {alumniProgress.length === 0 ? (
                <p className="text-sm text-gray-400">No alumni registration progress data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="text-left py-2">Batch No.</th>
                      <th className="text-left py-2">Training Program Name</th>
                      <th className="text-center py-2">% Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumniProgress.map((r: any, i: number) => {
                      const registeredPct = Number(r.registered_pct || 0);
                      return (
                        <tr key={`${r.batch_no || i}`} className="border-t border-gray-100">
                          <td className="py-2">{r.batch_no || '-'}</td>
                          <td className="py-2">{r.training_program || '-'}</td>
                          <td className="py-2 text-center"><span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-bold ${pctTone(registeredPct)}`}>{pct(registeredPct)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
