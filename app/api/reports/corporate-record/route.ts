/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

type CorporateRecordStatus = 'Follow Up' | 'CV Send' | 'Candidate Shortlisted' | 'Candidate Placed';
type PeriodMode = 'range' | 'month' | 'year';

const FOLLOWUP_STATUS_VALUES: CorporateRecordStatus[] = [
  'Follow Up',
  'CV Send',
  'Candidate Shortlisted',
  'Candidate Placed',
];

function formatDisplayDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'all';
}

function resolveDateRange(params: URLSearchParams) {
  const periodMode = ((params.get('periodMode') || 'range').trim().toLowerCase() || 'range') as PeriodMode;
  const fromDate = (params.get('fromDate') || '').trim();
  const toDate = (params.get('toDate') || '').trim();
  const monthRaw = (params.get('month') || '').trim();
  const yearRaw = (params.get('year') || '').trim();
  const year = Number(yearRaw);

  if (periodMode === 'month') {
    const month = Number(monthRaw);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new Error('Month is required for monthly reports');
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new Error('Year is required for monthly reports');
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0);
    return {
      periodMode,
      fromDate: start,
      toDate: `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
      label: `${String(month).padStart(2, '0')}-${year}`,
    };
  }

  if (periodMode === 'year') {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new Error('Year is required for yearly reports');
    }
    return {
      periodMode,
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
      label: String(year),
    };
  }

  if (!fromDate || !toDate) {
    throw new Error('From Date and To Date are required');
  }

  return {
    periodMode: 'range' as const,
    fromDate,
    toDate,
    label: `${fromDate}_to_${toDate}`,
  };
}

async function buildWorkbook(params: {
  status: CorporateRecordStatus;
  fromDate: string;
  toDate: string;
  companyName: string;
  courseName: string;
  rows: any[];
}) {
  const { status, fromDate, toDate, companyName, courseName, rows } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIT Manager';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Corporate Record', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const isFollowUp = status === 'Follow Up';
  const headers = isFollowUp
    ? ['Date', 'Discipline', 'Company Name', 'Contact Person', 'Mobile', 'E-mail', 'DirectLine', 'Designation', 'Purpose', 'Remark', 'WebSite', 'Mobile1', 'Status']
    : ['Date', 'Discipline', 'BatchNo', 'CandidateName', 'CompanyName', 'Remark'];

  const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB0B0B0' } };
  const allBorders: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

  worksheet.mergeCells(1, 1, 1, headers.length);
  const title = worksheet.getCell('A1');
  title.value = `Corporate Record Report (${status}) from : ${fromDate} To ${toDate}`;
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, headers.length);
  const subTitle = worksheet.getCell('A2');
  subTitle.value = `Company: ${companyName}   |   Course: ${courseName}   |   Total Records: ${rows.length}`;
  subTitle.font = { italic: true, size: 11, color: { argb: 'FF2E3093' } };
  subTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  subTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  worksheet.getRow(2).height = 20;

  const headerRow = worksheet.getRow(3);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6BB5' } };
    cell.border = allBorders;
  });
  headerRow.height = 24;

  if (rows.length === 0) {
    worksheet.mergeCells(4, 1, 4, headers.length);
    const cell = worksheet.getCell('A4');
    cell.value = 'No records found for the selected filters.';
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { italic: true, color: { argb: 'FF888888' } };
  } else {
    rows.forEach((row, index) => {
      const excelRow = worksheet.getRow(index + 4);
      const values = isFollowUp
        ? [
            formatDisplayDate(row.Date),
            row.Discipline || '',
            row.CompanyName || '',
            row.ContactPerson || '',
            row.Mobile || '',
            row.Email || '',
            row.DirectLine || '',
            row.Designation || '',
            row.Purpose || '',
            row.Remark || '',
            row.WebSite || '',
            row.Mobile1 || '',
            row.Status || '',
          ]
        : [
            formatDisplayDate(row.Date),
            row.Discipline || '',
            row.BatchNo || '',
            row.CandidateName || '',
            row.CompanyName || '',
            row.Remark || '',
          ];

      values.forEach((value, valueIndex) => {
        const cell = excelRow.getCell(valueIndex + 1);
        cell.value = value;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = allBorders;
      });

      if (index % 2 === 1) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
        });
      }
    });
  }

  const widths = isFollowUp
    ? [14, 22, 28, 22, 16, 28, 18, 18, 18, 42, 28, 16, 16]
    : [14, 22, 18, 28, 28, 40];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  return workbook.xlsx.writeBuffer();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const optionsMode = (searchParams.get('options') || '').trim().toLowerCase() === 'filters';
    const auth = await requirePermission(req, optionsMode ? 'report_corporate_record.view' : 'report_corporate_record.export');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();

    if (optionsMode) {
      const [companies, courses] = await Promise.all([
        pool.query<any[]>(
          `SELECT Const_Id, Comp_Name
           FROM consultant_mst
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Comp_Name`
        ),
        pool.query<any[]>(
          `SELECT Course_Id, Course_Name
           FROM course_mst
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Course_Name`
        ),
      ]);
      const [purposes] = await pool.query<any[]>(
        `SELECT DISTINCT TRIM(Purpose) AS Purpose
         FROM consultant_follows
         WHERE Purpose IS NOT NULL AND TRIM(Purpose) != ''
           AND (IsDelete = 0 OR IsDelete IS NULL OR IsDelete = '' OR IsDelete = '0' OR IsDelete = 'N' OR IsDelete = 'No')
         ORDER BY TRIM(Purpose)`
      );

      const purposeRows = Array.isArray(purposes) ? purposes : [];
      const purposeValues = purposeRows
        .map((row) => String(row.Purpose || '').trim())
        .filter(Boolean);
      if (!purposeValues.some((value) => value.toLowerCase() === 'candidate placed')) {
        purposeValues.push('Candidate Placed');
      }

      return NextResponse.json({
        companies: (companies[0] as any[]).map((row) => ({ id: Number(row.Const_Id), name: String(row.Comp_Name || '').trim() })),
        courses: (courses[0] as any[]).map((row) => ({ id: Number(row.Course_Id), name: String(row.Course_Name || '').trim() })),
        purposes: purposeValues,
        statuses: FOLLOWUP_STATUS_VALUES,
      });
    }

    const companyIdRaw = (searchParams.get('companyId') || '').trim();
    const courseIdRaw = (searchParams.get('courseId') || '').trim();
    const purposeRaw = (searchParams.get('purpose') || '').trim();
    const status = (searchParams.get('status') || '').trim() as CorporateRecordStatus;

    const companyId = Number(companyIdRaw);
    const courseId = Number(courseIdRaw);
    const includeAllCompanies = !companyIdRaw || companyIdRaw === '0' || companyIdRaw.toLowerCase() === 'all';
    const includeAllCourses = !courseIdRaw || courseIdRaw === '0' || courseIdRaw.toLowerCase() === 'all';
    const includeAllPurposes = !purposeRaw || purposeRaw === 'all';
    const companyIdFilter = includeAllCompanies && !Number.isFinite(companyId) ? 0 : companyId;
    const courseIdFilter = includeAllCourses && !Number.isFinite(courseId) ? 0 : courseId;
    const { fromDate, toDate, label: periodLabel } = resolveDateRange(searchParams);
    if (!includeAllCompanies && (!Number.isFinite(companyId) || companyId <= 0)) {
      return NextResponse.json({ error: 'Select Company is required' }, { status: 400 });
    }
    if (!includeAllCourses && (!Number.isFinite(courseId) || courseId <= 0)) {
      return NextResponse.json({ error: 'Select Course is required' }, { status: 400 });
    }
    if (!FOLLOWUP_STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: 'Follow-up status is required' }, { status: 400 });
    }
    if (status === 'Follow Up' && !includeAllPurposes && !purposeRaw) {
      return NextResponse.json({ error: 'Select Purpose is required' }, { status: 400 });
    }

    const [[companyRows], [courseRows]] = await Promise.all([
      includeAllCompanies
        ? Promise.resolve([[]] as unknown as any)
        : pool.query<any[]>(`SELECT Const_Id, Comp_Name FROM consultant_mst WHERE Const_Id = ? LIMIT 1`, [companyId]),
      includeAllCourses
        ? Promise.resolve([[]] as unknown as any)
        : pool.query<any[]>(`SELECT Course_Id, Course_Name FROM course_mst WHERE Course_Id = ? LIMIT 1`, [courseId]),
    ]);

    const companyName = includeAllCompanies
      ? 'All Companies'
      : String(companyRows?.[0]?.Comp_Name || '').trim() || `Company ${companyId}`;
    const courseName = includeAllCourses
      ? 'All Courses'
      : String(courseRows?.[0]?.Course_Name || '').trim() || `Course ${courseId}`;
    const purposeName = includeAllPurposes ? 'All Purposes' : purposeRaw;

    let rows: any[] = [];

    if (status === 'Follow Up') {
      const followupDateExpr = `COALESCE(NULLIF(TRIM(f.Tdate), ''), NULLIF(TRIM(f.nextdate), ''))`;
      const followupDateSortExpr = `COALESCE(
        STR_TO_DATE(${followupDateExpr}, '%Y-%m-%d'),
        STR_TO_DATE(${followupDateExpr}, '%d-%m-%Y'),
        STR_TO_DATE(${followupDateExpr}, '%d/%m/%Y'),
        STR_TO_DATE(${followupDateExpr}, '%m/%d/%Y')
      )`;

      const [result] = await pool.query<any[]>(
        `SELECT
           ${followupDateExpr} AS Date,
           COALESCE(NULLIF(TRIM(f.Course), ''), ?) AS Discipline,
           COALESCE(cm.Comp_Name, '') AS CompanyName,
           COALESCE(f.CName, '') AS ContactPerson,
           COALESCE(f.Phone, '') AS Mobile,
           COALESCE(f.Email, '') AS Email,
           COALESCE(f.DirectLine, '') AS DirectLine,
           COALESCE(f.Designation, '') AS Designation,
           COALESCE(f.Purpose, '') AS Purpose,
           COALESCE(f.Remark, '') AS Remark,
           COALESCE(cm.Website, '') AS WebSite,
           COALESCE(cm.Mobile, '') AS Mobile1,
           COALESCE(cm.Company_Status, '') AS Status
         FROM consultant_follows f
         INNER JOIN consultant_mst cm
           ON CAST(NULLIF(TRIM(f.Consultant_Id), '') AS UNSIGNED) = cm.Const_Id
         WHERE (f.IsDelete = 0 OR f.IsDelete IS NULL OR f.IsDelete = '' OR f.IsDelete = '0' OR f.IsDelete = 'N' OR f.IsDelete = 'No')
           AND (cm.IsDelete = 0 OR cm.IsDelete IS NULL)
           AND (? = 1 OR cm.Const_Id = ?)
           AND ${followupDateSortExpr} IS NOT NULL
           AND DATE(${followupDateSortExpr}) BETWEEN ? AND ?
           AND (? = 1 OR LOWER(TRIM(COALESCE(f.Purpose, ''))) = LOWER(?))
           AND (
             ? = 1
             OR CAST(NULLIF(TRIM(f.Course), '') AS UNSIGNED) = ?
             OR LOWER(TRIM(COALESCE(f.Course, ''))) = LOWER(?)
             OR cm.Course_Id1 = ? OR cm.Course_Id2 = ? OR cm.Course_Id3 = ?
             OR cm.Course_Id4 = ? OR cm.Course_Id5 = ? OR cm.Course_Id6 = ?
           )
         ORDER BY ${followupDateSortExpr} DESC, f.ID DESC`,
          [courseName, includeAllCompanies ? 1 : 0, companyIdFilter, fromDate, toDate, includeAllPurposes ? 1 : 0, purposeName, includeAllCourses ? 1 : 0, courseIdFilter, courseName, courseIdFilter, courseIdFilter, courseIdFilter, courseIdFilter, courseIdFilter, courseIdFilter]
      );
      rows = result;
    } else {
      const statusCondition =
        status === 'CV Send'
          ? `LOWER(TRIM(COALESCE(cc.Sended, ''))) = 'yes'`
          : status === 'Candidate Shortlisted'
            ? `LOWER(TRIM(COALESCE(cc.Result, ''))) = 'yes'`
            : `LOWER(TRIM(COALESCE(cc.Placement, ''))) = 'yes'`;

      const [result] = await pool.query<any[]>(
        `SELECT
           cv.TDate AS Date,
           COALESCE(c.Course_Name, CONCAT('Course ', cv.Course_id)) AS Discipline,
           COALESCE(b.Batch_Code, '') AS BatchNo,
           COALESCE(cc.Student_Name, '') AS CandidateName,
           COALESCE(NULLIF(TRIM(cv.CompanyName), ''), cm.Comp_Name, ?) AS CompanyName,
           COALESCE(cc.Remark, '') AS Remark
         FROM cv_shortlisted cv
         INNER JOIN cvchild cc
           ON cc.CV_Id = cv.id
          AND (cc.IsDelete = 0 OR cc.IsDelete IS NULL)
         LEFT JOIN consultant_mst cm
           ON cm.Const_Id = cv.Company_Id
         LEFT JOIN course_mst c
           ON c.Course_Id = cv.Course_id
         LEFT JOIN batch_mst b
           ON b.Batch_Id = cv.Batch_Id
         WHERE (cv.IsDelete = 0 OR cv.IsDelete IS NULL)
           AND DATE(cv.TDate) BETWEEN ? AND ?
           AND (? = 1 OR cv.Company_Id = ? OR LOWER(TRIM(COALESCE(cv.CompanyName, ''))) = LOWER(?))
           AND (? = 1 OR cv.Course_id = ?)
           AND ${statusCondition}
         ORDER BY cv.TDate DESC, cv.id DESC, cc.Id DESC`,
        [companyName, fromDate, toDate, includeAllCompanies ? 1 : 0, companyIdFilter, companyName, includeAllCourses ? 1 : 0, courseIdFilter]
      );
      rows = result;
    }

    const buffer = await buildWorkbook({ status, fromDate, toDate, companyName, courseName, rows });
    const fileName = `Corporate_Record_${sanitizeFilePart(status)}_${sanitizeFilePart(companyName)}_${sanitizeFilePart(periodLabel)}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    console.error('Corporate record report error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}