'use client';

export interface MonitoringDayRow {
  date: string;
  day: string;
  admissions: number;
  incomingCalls: number;
  freshCallsMeta: number;
  freshCallsOthers: number;
  followupCalls: number;
  walkIns: number;
  firstHalfSummary: string | null;
  secondHalfSummary: string | null;
  whatsapp: number | null;
  emailsReplied: number | null;
  socialMediaInquiries: number | null;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function isToday(d: string): boolean {
  return d === new Date().toISOString().slice(0, 10);
}

const AUTO_ROWS: { key: 'incomingCalls' | 'freshCallsMeta' | 'freshCallsOthers' | 'followupCalls' | 'walkIns'; label: string }[] = [
  { key: 'incomingCalls', label: 'Incoming Calls' },
  { key: 'freshCallsMeta', label: 'Fresh Calls (Meta)' },
  { key: 'freshCallsOthers', label: 'Fresh Calls (Others)' },
];

const AUTO_ROWS_AFTER_WHATSAPP: { key: 'followupCalls' | 'walkIns'; label: string }[] = [
  { key: 'followupCalls', label: 'Followup Calls' },
  { key: 'walkIns', label: 'No. of Walk-in Enquiries' },
];

const headCellBase = 'border border-slate-200 px-2.5 py-2 text-xs align-middle';
const labelCellCls = `${headCellBase} font-semibold text-slate-600 bg-slate-50 whitespace-nowrap`;
const dataCellCls = `${headCellBase} text-center text-slate-700 font-medium`;
const inquiriesLabelCls = `${headCellBase} font-bold text-[#2E3093] bg-[#2E3093]/5 text-center align-middle`;

function todayRing(date: string): string {
  return isToday(date) ? 'ring-2 ring-inset ring-[#2E3093]/40' : '';
}

export default function MonitoringWeeklyTable({
  employeeLabel,
  days,
  canEdit,
  onSaveDay,
  refreshKey,
}: {
  employeeLabel: string;
  days: MonitoringDayRow[];
  canEdit: boolean;
  onSaveDay: (row: MonitoringDayRow) => void;
  /** Changes when the underlying data source changes (e.g. selected employee) so the
   *  uncontrolled manual-entry inputs below remount and pick up fresh defaultValues
   *  instead of holding onto stale text from whoever was previously selected. */
  refreshKey: string;
}) {
  const updateLocal = (date: string, patch: Partial<MonitoringDayRow>) => {
    const row = days.find((d) => d.date === date);
    if (row) onSaveDay({ ...row, ...patch });
  };

  if (!days.length) return null;

  const cellKey = (date: string) => `${refreshKey}:${date}`;

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-2.5">
        <span className="text-sm font-bold text-white tracking-tight">Employee Name : {employeeLabel}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full" style={{ minWidth: '900px' }}>
          <tbody>
            <tr>
              <td className={labelCellCls}>Date</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${dataCellCls} ${todayRing(d.date)} bg-slate-50 font-bold`}>
                  {formatDate(d.date)}
                </td>
              ))}
            </tr>
            <tr>
              <td className={labelCellCls}>Day</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${dataCellCls} ${todayRing(d.date)} bg-slate-50`}>
                  {d.day}
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls}>First Half<br />Summary</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${headCellBase} bg-[#FAE452]/40 ${todayRing(d.date)}`}>
                  <textarea
                    key={cellKey(d.date)}
                    defaultValue={d.firstHalfSummary ?? ''}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Type here…' : ''}
                    onBlur={(e) => updateLocal(d.date, { firstHalfSummary: e.target.value })}
                    className="w-full min-w-[110px] h-14 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 rounded disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className={labelCellCls}>Second Half<br />Summary</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${headCellBase} bg-[#FAE452]/40 ${todayRing(d.date)}`}>
                  <textarea
                    key={cellKey(d.date)}
                    defaultValue={d.secondHalfSummary ?? ''}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Type here…' : ''}
                    onBlur={(e) => updateLocal(d.date, { secondHalfSummary: e.target.value })}
                    className="w-full min-w-[110px] h-14 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 rounded disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls}>No. of Admissions</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${dataCellCls} ${todayRing(d.date)}`}>
                  {d.admissions}
                </td>
              ))}
            </tr>

            {AUTO_ROWS.map((row, idx) => (
              <tr key={row.key}>
                {idx === 0 && (
                  <td className={inquiriesLabelCls} rowSpan={8}>
                    Inquiries
                  </td>
                )}
                <td className={labelCellCls}>{row.label}</td>
                {days.map((d) => (
                  <td key={cellKey(d.date)} className={`${dataCellCls} ${todayRing(d.date)}`}>
                    {d[row.key]}
                  </td>
                ))}
              </tr>
            ))}

            <tr>
              <td className={labelCellCls}>WhatsApp Enquiries</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${headCellBase} bg-[#FAE452]/40 ${todayRing(d.date)}`}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.whatsapp ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { whatsapp: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full min-w-[60px] bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 rounded disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            {AUTO_ROWS_AFTER_WHATSAPP.map((row) => (
              <tr key={row.key}>
                <td className={labelCellCls}>{row.label}</td>
                {days.map((d) => (
                  <td key={cellKey(d.date)} className={`${dataCellCls} ${todayRing(d.date)}`}>
                    {d[row.key]}
                  </td>
                ))}
              </tr>
            ))}

            <tr>
              <td className={labelCellCls}>No. of Emails Replied to</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${headCellBase} bg-[#FAE452]/40 ${todayRing(d.date)}`}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.emailsReplied ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { emailsReplied: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full min-w-[60px] bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 rounded disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls}>Social Media Inquiries</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${headCellBase} bg-[#FAE452]/40 ${todayRing(d.date)}`}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.socialMediaInquiries ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { socialMediaInquiries: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full min-w-[60px] bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 rounded disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-500">
        <span className="w-3 h-3 rounded-sm bg-[#FAE452] border border-slate-300 inline-block shrink-0" />
        Yellow cells are filled in by the employee — everything else is generated automatically from system data.
      </div>
    </div>
  );
}
