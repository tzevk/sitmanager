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

const cellBase = 'border border-gray-100 px-2.5 py-2 text-xs align-middle';
const labelCellCls = `${cellBase} font-semibold text-slate-600 bg-slate-50/80 whitespace-nowrap`;
const dataCellCls = `${cellBase} text-center text-slate-700 font-semibold tabular-nums`;
const manualCellCls = `${cellBase} bg-[#FAE452]/25`;
const inquiriesLabelCls = `${cellBase} font-bold text-[#2E3093] bg-[#2E3093]/[0.04] text-center align-middle tracking-wide`;

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
    <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-2.5 flex items-center gap-2">
        <svg className="w-4 h-4 text-white/80 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-sm font-bold text-white tracking-tight">Employee Name : {employeeLabel}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full table-fixed" style={{ minWidth: '900px' }}>
          <colgroup>
            {/* Narrow spanning "Inquiries" column — only rendered as its own <td> on one row
                (rowSpan covers the rest), but it's still a real column the table must size. */}
            <col style={{ width: '36px' }} />
            <col style={{ width: '150px' }} />
            {days.map((d) => (
              <col key={cellKey(d.date)} style={{ width: 'calc((100% - 186px) / 7)' }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              <td className={labelCellCls} colSpan={2}>Date</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${dataCellCls} bg-slate-50`}>
                  <div className="flex items-center justify-center gap-1">
                    {formatDate(d.date)}
                    {isToday(d.date) && (
                      <span className="text-[8px] font-bold text-white bg-[#2E3093] rounded-full px-1.5 py-0.5 leading-none">
                        TODAY
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className={labelCellCls} colSpan={2}>Day</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={`${dataCellCls} bg-slate-50 font-medium text-slate-500`}>
                  {d.day}
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls} colSpan={2}>First Half<br />Summary</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={manualCellCls}>
                  <textarea
                    key={cellKey(d.date)}
                    defaultValue={d.firstHalfSummary ?? ''}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Type here…' : ''}
                    onBlur={(e) => updateLocal(d.date, { firstHalfSummary: e.target.value })}
                    className="w-full h-14 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 rounded-md disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className={labelCellCls} colSpan={2}>Second Half<br />Summary</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={manualCellCls}>
                  <textarea
                    key={cellKey(d.date)}
                    defaultValue={d.secondHalfSummary ?? ''}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Type here…' : ''}
                    onBlur={(e) => updateLocal(d.date, { secondHalfSummary: e.target.value })}
                    className="w-full h-14 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 rounded-md disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls} colSpan={2}>No. of Admissions</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={dataCellCls}>
                  {d.admissions}
                </td>
              ))}
            </tr>

            {AUTO_ROWS.map((row, idx) => (
              <tr key={row.key}>
                {idx === 0 && (
                  <td className={inquiriesLabelCls} rowSpan={8}>
                    <span className="[writing-mode:vertical-rl] rotate-180 inline-block">Inquiries</span>
                  </td>
                )}
                <td className={labelCellCls}>{row.label}</td>
                {days.map((d) => (
                  <td key={cellKey(d.date)} className={dataCellCls}>
                    {d[row.key]}
                  </td>
                ))}
              </tr>
            ))}

            <tr>
              <td className={labelCellCls}>WhatsApp Enquiries</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={manualCellCls}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.whatsapp ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { whatsapp: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 rounded-md disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            {AUTO_ROWS_AFTER_WHATSAPP.map((row) => (
              <tr key={row.key}>
                <td className={labelCellCls}>{row.label}</td>
                {days.map((d) => (
                  <td key={cellKey(d.date)} className={dataCellCls}>
                    {d[row.key]}
                  </td>
                ))}
              </tr>
            ))}

            <tr>
              <td className={labelCellCls}>No. of Emails Replied to</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={manualCellCls}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.emailsReplied ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { emailsReplied: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 rounded-md disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>

            <tr>
              <td className={labelCellCls}>Social Media Inquiries</td>
              {days.map((d) => (
                <td key={cellKey(d.date)} className={manualCellCls}>
                  <input
                    key={cellKey(d.date)}
                    type="number"
                    defaultValue={d.socialMediaInquiries ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => updateLocal(d.date, { socialMediaInquiries: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 rounded-md disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 bg-slate-50/60 text-[10px] text-slate-500">
        <span className="w-3 h-3 rounded-sm bg-[#FAE452] border border-slate-300 inline-block shrink-0" />
        Yellow cells are filled in by the employee — everything else is generated automatically from system data.
      </div>

      <details className="border-t border-gray-100 px-4 py-2.5">
        <summary className="text-[11px] font-semibold text-[#2E3093] cursor-pointer select-none">
          How is each row calculated?
        </summary>
        <dl className="mt-2 space-y-1.5 text-[10.5px] text-slate-600 leading-snug">
          <div>
            <dt className="font-semibold text-slate-700 inline">No. of Admissions —</dt>{' '}
            <dd className="inline">Admissions accepted this day, credited to the employee who accepted it (or, for older records made before this was tracked, whoever last followed up on that inquiry before it was admitted).</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">Incoming Calls —</dt>{' '}
            <dd className="inline">New inquiries created with mode &ldquo;Call&rdquo;, credited to whoever logged the first follow-up on that inquiry.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">Fresh Calls (Meta) —</dt>{' '}
            <dd className="inline">New inquiries created by converting a synced Meta (Facebook/Instagram) lead, credited to whoever logged the first follow-up on that inquiry.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">Fresh Calls (Others) —</dt>{' '}
            <dd className="inline">The first follow-up logged on any other new inquiry — i.e. not Call-mode and not Meta-sourced (WhatsApp, Walk-In, Email, Website, Social Media, etc.).</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">Followup Calls —</dt>{' '}
            <dd className="inline">Any later follow-up logged on an inquiry that already had at least one earlier follow-up.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">No. of Walk-in Enquiries —</dt>{' '}
            <dd className="inline">New inquiries created with mode &ldquo;Walk-In&rdquo;, credited to whoever logged the first follow-up on that inquiry.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700 inline">First/Second Half Summary, WhatsApp Enquiries, No. of Emails Replied to, Social Media Inquiries —</dt>{' '}
            <dd className="inline">Typed in directly by the employee (yellow cells); there is no automatic system source for these.</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
