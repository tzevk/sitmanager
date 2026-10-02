/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Printable HTML for the Performance Report (form F/TD/08/02), built from the
 * performance-report API response. Kept out of the page component so the exact
 * printed markup can be rendered and checked outside the browser UI.
 * Every value is HTML-escaped.
 */
export function renderPerformanceReportHtml(data: any): string {
  const header: any = data.header || {};
  const students: any[] = data.students || [];
  const criteria: any[] = data.passingCriteria || [];

  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const fix2 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : '0.00'; };
  const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0'; };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reportDate = (() => {
    const m = String(header.Result_date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]} - ${months[Number(m[2]) - 1]} - ${m[1]}` : '';
  })();
  const gradeLabel = (g: string) => (g === 'NO CERT' ? 'NO CERTIFICATE' : g || 'NA');
  const range = (c: { grade: string; from: number; to: number | null }) =>
    c.grade === 'No certificate' ? `${fix2(c.to)} and below` : `${fix2(c.from)}% to ${c.to === 100 ? '100' : fix2(c.to)}%`;

  // One cell per assignment / unit test: number on top, mark (or Absent /
  // Not Submitted / -) underneath. Absent-type cells are bold so they stand out.
  // Columns are ~7mm wide on the printed form, so "Not Submitted" prints as "NS"
  // with a key under the grid; "Absent" fits at the smaller flag size.
  // "†" marks an assignment entry on a day the student was absent from every
  // lecture — shown alongside the mark, never replacing it.
  const cellText = (c: any) => `${c.status === 'not_submitted' ? 'NS' : c.display}${c.absentOnLectureDate ? '†' : ''}`;
  const markGrid = (cells: any[], prefix: string) => cells.length === 0
    ? '<span class="muted">None recorded</span>'
    : `<table class="grid"><tr>${cells.map((c) => `<th>${prefix}${esc(c.no)}</th>`).join('')}</tr>
         <tr>${cells.map((c) => `<td class="${c.status === 'marks' ? '' : 'flag'}">${esc(cellText(c))}</td>`).join('')}</tr></table>${
        (() => {
          const keys = [
            cells.some((c) => c.status === 'not_submitted') ? 'NS = Not Submitted' : '',
            cells.some((c) => c.absentOnLectureDate) ? '† = Absent on lecture date' : '',
          ].filter(Boolean);
          return keys.length ? `<div class="key">${keys.join(' · ')}</div>` : '';
        })()}`;

  // Signatories in the printed form's order: Training Coordinator, Faculty,
  // Managing Director. Results from the legacy system store the coordinator in
  // Faculty1 (labels often just "Training"); results saved from this app label
  // Faculty2 as "Training Coordinator" — follow the label when it's explicit.
  const coordIsFaculty2 = /coordinator/i.test(String(header.Label2 || '')) && !/coordinator/i.test(String(header.Label1 || ''));
  const coordinatorName = coordIsFaculty2 ? header.faculty2 : header.faculty1;
  const facultyName = coordIsFaculty2 ? header.faculty1 : header.faculty2;

  const card = (s: any) => `
    <div class="page">
      <table class="rep head">
        <colgroup><col style="width:33%"><col style="width:16.7%"><col style="width:24.3%"><col style="width:26%"></colgroup>
        <tr><th colspan="4" class="title">PERFORMANCE REPORT</th></tr>
        <tr>
          <td colspan="2">Name : <b>${esc(s.Student_Name)}</b></td>
          <td colspan="2">ID No : <b>${esc(s.Roll_No || s.Student_Code)}</b></td>
        </tr>
        <tr>
          <td colspan="2">Training Programme: <b>${esc(header.Course_Name)}</b></td>
          <td>Batch No : <b>${esc(header.Batch_code)}</b></td>
          <td>Date: <b>${esc(reportDate)}</b></td>
        </tr>
        <tr>
          <td class="lbl"><b>Passing Criteria :</b></td>
          <td colspan="3" class="nopad">
            <table class="crit">${criteria.map((c) => `<tr><td>${esc(c.grade)}</td><td>${esc(range(c))}</td></tr>`).join('')}</table>
          </td>
        </tr>
        ${header.Course_Description ? `<tr><td colspan="4" class="desc"><b>Brief Description of Training Programme :</b><br/>${esc(header.Course_Description)}</td></tr>` : ''}
      </table>

      <table class="rep sec">
        <colgroup><col style="width:4.5%"><col style="width:19%"><col style="width:33.5%"><col style="width:43%"></colgroup>
        <tr><td rowspan="5" class="no">01</td><td rowspan="5" class="name">Assignments</td>
            <td class="k">Total No of Assignments/ s</td><td>${esc(s.assignments.total)}</td></tr>
        <tr><td class="k">Assignments Submitted</td><td>${esc(s.assignments.submitted)}</td></tr>
        <tr><td class="k">Marks obtained in Assignments</td><td class="nopad">${markGrid(s.assignments.cells, 'A')}</td></tr>
        <tr><td class="k">Total Marks obtained in Assignments</td><td>${esc(s.assignments.obtained)} / ${esc(s.assignments.max)}</td></tr>
        <tr><td class="k"><b>Weightage - ${esc(s.assignments.weightage)}%</b></td><td>${fix2(s.assignments.weighted)}<span class="tag">(A)</span></td></tr>

        <tr><td rowspan="5" class="no">02</td><td rowspan="5" class="name">Unit Tests</td>
            <td class="k">Total Unit Test/s</td><td>${esc(s.unitTests.total)}</td></tr>
        <tr><td class="k">Attended Unit Test/s</td><td>${esc(s.unitTests.attended)}</td></tr>
        <tr><td class="k">Marks obtained in Unit Test/s</td><td class="nopad">${markGrid(s.unitTests.cells, 'T')}</td></tr>
        <tr><td class="k">Total Marks obtained in Unit Test/s</td><td>${esc(s.unitTests.obtained)} / ${esc(s.unitTests.max)}</td></tr>
        <tr><td class="k"><b>Weightage - ${esc(s.unitTests.weightage)}%</b></td><td>${fix2(s.unitTests.weighted)}<span class="tag">(B)</span></td></tr>

        <tr><td rowspan="2" class="no">03</td><td rowspan="2" class="name">Final Examination</td>
            <td class="k">Marks obtained</td>
            <td class="nopad"><table class="grid">
              <tr>${s.finalExam.attempts.map((a: { label: string }) => `<th>${esc(a.label)}</th>`).join('')}</tr>
              <tr>${s.finalExam.attempts.map((a: { status: string; display: string }) => `<td class="${a.status === 'marks' ? '' : 'flag'}">${esc(a.display)}</td>`).join('')}</tr>
            </table></td></tr>
        <tr><td class="k"><b>Weightage - ${esc(s.finalExam.weightage)}%</b></td><td>${fix2(s.finalExam.weighted)}<span class="tag">(C)</span></td></tr>

        <tr><td rowspan="3" class="no">04</td><td rowspan="3" class="name">Attendance Record</td>
            <td class="k">Attended Lectures/Total Lectures</td><td>${esc(s.attendance.attended)} / ${esc(s.attendance.total)}</td></tr>
        <tr><td class="k">Total No of Absent Days</td><td>${esc(s.attendance.absentDays)}</td></tr>
        <tr><td class="k"><b>Attendance %</b></td><td>${pct(s.attendance.percentage)}</td></tr>

        <tr><td rowspan="${Number(s.discipline) > 0 ? 3 : 2}" class="no">05</td><td rowspan="${Number(s.discipline) > 0 ? 3 : 2}" class="name">Final Result</td>
            <td class="k"><b>A + B + C${Number(s.discipline) > 0 ? ' − Discipline' : ''}</b></td><td>${fix2(s.totalScore)}</td></tr>
        ${Number(s.discipline) > 0 ? `<tr><td class="k">Discipline deduction</td><td>${fix2(s.discipline)}</td></tr>` : ''}
        <tr><td class="k"><b>Grade</b></td><td><b>${esc(gradeLabel(s.grade))}</b></td></tr>
      </table>

      <table class="rep sign">
        <tr><td class="space"></td><td class="space"></td><td class="space"></td></tr>
        <tr><td class="who">${esc(coordinatorName)}</td><td class="who">${esc(facultyName)}</td><td class="who">${esc(header.approve_by)}</td></tr>
        <tr><th>Training Coordinator</th><th>Faculty</th><th>Managing Director</th></tr>
      </table>
      <div class="form-no">F/TD/08/02</div>
    </div>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Performance Report - ${esc(header.Batch_code)}</title><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 11.5px; }
    /* Printed form: ~46mm top (letterhead), ~21mm sides, content 168mm wide. */
    .page { width: 168mm; margin: 0 auto; padding: 46mm 0 12mm; page-break-after: always; }
    table.rep { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rep + table.rep { margin-top: -1px; }
    .rep th, .rep td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; text-align: left; }
    .rep .title { text-align: center; font-size: 13px; padding: 7px; }
    .rep .lbl { vertical-align: middle; }
    .rep .nopad { padding: 0; }
    .rep .desc { font-size: 9.5px; line-height: 1.35; }
    .crit { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .crit td { border: none; border-bottom: 1px solid #000; padding: 1.5px 6px; font-size: 10.5px; width: 50%; }
    .crit tr:last-child td { border-bottom: none; }
    .sec .no { text-align: center; }
    .tag { float: right; padding-right: 30px; }
    .grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .grid th, .grid td { border: none; border-right: 1px solid #999; text-align: center; padding: 2px 1px; font-size: 10px; }
    .grid th { font-weight: 600; color: #444; border-bottom: 1px solid #999; }
    .grid th:last-child, .grid td:last-child { border-right: none; }
    .grid td.flag { font-weight: 700; font-size: 7px; letter-spacing: -0.1px; }
    .key { font-size: 8px; padding: 1px 4px; border-top: 1px solid #999; }
    .muted { color: #666; padding: 4px 6px; display: inline-block; }
    .sign { margin-top: 18px !important; }
    .sign td, .sign th { text-align: center; width: 33.33%; padding: 2px 6px; height: 7mm; }
    .sign .space { height: 16mm; }
    .sign .who { text-transform: uppercase; }
    .form-no { margin-top: 6px; font-weight: 700; font-size: 11px; }
    @media print { @page { size: A4 portrait; margin: 0; } }
  </style></head><body>${students.map(card).join('')}<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script></body></html>`);
}
