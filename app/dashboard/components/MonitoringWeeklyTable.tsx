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

const AUTO_ROWS: { key: 'incomingCalls' | 'freshCallsMeta' | 'freshCallsOthers' | 'followupCalls' | 'walkIns'; label: string }[] = [
  { key: 'incomingCalls', label: 'Incoming Calls' },
  { key: 'freshCallsMeta', label: 'Fresh Calls (Meta)' },
  { key: 'freshCallsOthers', label: 'Fresh Calls (Others)' },
];

const AUTO_ROWS_AFTER_WHATSAPP: { key: 'followupCalls' | 'walkIns'; label: string }[] = [
  { key: 'followupCalls', label: 'Followup Calls' },
  { key: 'walkIns', label: 'No. of Walk-in Enquiries' },
];

const cellCls = 'border border-black px-2 py-1.5 text-xs text-center align-middle';
const labelCellCls = 'border border-black px-2 py-1.5 text-xs font-medium align-middle';
const manualCellCls = `${cellCls} bg-yellow-300`;

export default function MonitoringWeeklyTable({
  employeeLabel,
  days,
  canEdit,
  onSaveDay,
}: {
  employeeLabel: string;
  days: MonitoringDayRow[];
  canEdit: boolean;
  onSaveDay: (row: MonitoringDayRow) => void;
}) {
  const updateLocal = (date: string, patch: Partial<MonitoringDayRow>) => {
    const row = days.find((d) => d.date === date);
    if (row) onSaveDay({ ...row, ...patch });
  };

  if (!days.length) return null;

  return (
    <div className="border border-gray-200 rounded overflow-auto">
      <table className="border-collapse text-xs" style={{ minWidth: '900px' }}>
        <tbody>
          <tr>
            <td className={`${labelCellCls} bg-white text-center`} colSpan={8}>
              Employee Name : {employeeLabel}
            </td>
          </tr>
          <tr>
            <td className={labelCellCls}>Date</td>
            {days.map((d) => (
              <td key={d.date} className={`${cellCls} font-semibold`}>{formatDate(d.date)}</td>
            ))}
          </tr>
          <tr>
            <td className={labelCellCls}>Day</td>
            {days.map((d) => (
              <td key={d.date} className={cellCls}>{d.day}</td>
            ))}
          </tr>
          <tr>
            <td className={labelCellCls}>First Half<br />Summary</td>
            {days.map((d) => (
              <td key={d.date} className={manualCellCls}>
                <textarea
                  defaultValue={d.firstHalfSummary ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => updateLocal(d.date, { firstHalfSummary: e.target.value })}
                  className="w-full min-w-[110px] h-14 bg-transparent text-xs resize-none focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={labelCellCls}>Second Half<br />Summary</td>
            {days.map((d) => (
              <td key={d.date} className={manualCellCls}>
                <textarea
                  defaultValue={d.secondHalfSummary ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => updateLocal(d.date, { secondHalfSummary: e.target.value })}
                  className="w-full min-w-[110px] h-14 bg-transparent text-xs resize-none focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className={labelCellCls}>No. of Admissions</td>
            {days.map((d) => (
              <td key={d.date} className={cellCls}>{d.admissions}</td>
            ))}
          </tr>

          {AUTO_ROWS.map((row, idx) => (
            <tr key={row.key}>
              {idx === 0 && (
                <td className={`${labelCellCls} text-center`} rowSpan={8}>
                  Inquiries
                </td>
              )}
              <td className={labelCellCls}>{row.label}</td>
              {days.map((d) => (
                <td key={d.date} className={cellCls}>{d[row.key]}</td>
              ))}
            </tr>
          ))}

          <tr>
            <td className={labelCellCls}>WhatsApp Enquiries</td>
            {days.map((d) => (
              <td key={d.date} className={manualCellCls}>
                <input
                  type="number"
                  defaultValue={d.whatsapp ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => updateLocal(d.date, { whatsapp: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full min-w-[60px] bg-transparent text-xs text-center focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
            ))}
          </tr>

          {AUTO_ROWS_AFTER_WHATSAPP.map((row) => (
            <tr key={row.key}>
              <td className={labelCellCls}>{row.label}</td>
              {days.map((d) => (
                <td key={d.date} className={cellCls}>{d[row.key]}</td>
              ))}
            </tr>
          ))}

          <tr>
            <td className={labelCellCls}>No. of Emails Replied to</td>
            {days.map((d) => (
              <td key={d.date} className={manualCellCls}>
                <input
                  type="number"
                  defaultValue={d.emailsReplied ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => updateLocal(d.date, { emailsReplied: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full min-w-[60px] bg-transparent text-xs text-center focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
            ))}
          </tr>

          <tr>
            <td className={labelCellCls}>Social Media Inquiries</td>
            {days.map((d) => (
              <td key={d.date} className={manualCellCls}>
                <input
                  type="number"
                  defaultValue={d.socialMediaInquiries ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) => updateLocal(d.date, { socialMediaInquiries: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full min-w-[60px] bg-transparent text-xs text-center focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
