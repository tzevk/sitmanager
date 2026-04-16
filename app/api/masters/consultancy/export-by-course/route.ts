/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import ExcelJS from 'exceljs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const courseRaw = (searchParams.get('courseId') || '').trim();
    const isAllTrainingProgrammes = courseRaw === '' || courseRaw.toLowerCase() === 'all' || courseRaw === '0';
    const courseId = isAllTrainingProgrammes ? 0 : Number(courseRaw);
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();

    if (!isAllTrainingProgrammes && (!Number.isFinite(courseId) || courseId <= 0)) {
      return NextResponse.json({ error: 'Invalid training programme' }, { status: 400 });
    }
    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Date From and Date To are required' }, { status: 400 });
    }

    const pool = getPool();

    let courseName = 'All Training Programmes';
    if (!isAllTrainingProgrammes) {
      const [courseRows] = await pool.query<any[]>(
        `SELECT Course_Name FROM course_mst WHERE Course_Id = ? LIMIT 1`,
        [courseId]
      );
      courseName = courseRows?.[0]?.Course_Name || `Training Programme ${courseId}`;
    }

    const courseFilterSql = isAllTrainingProgrammes
      ? `AND (
           cm.Course_Id1 IS NOT NULL OR cm.Course_Id2 IS NOT NULL OR cm.Course_Id3 IS NOT NULL
           OR cm.Course_Id4 IS NOT NULL OR cm.Course_Id5 IS NOT NULL OR cm.Course_Id6 IS NOT NULL
         )`
      : `AND (
           cm.Course_Id1 = ? OR cm.Course_Id2 = ? OR cm.Course_Id3 = ?
           OR cm.Course_Id4 = ? OR cm.Course_Id5 = ? OR cm.Course_Id6 = ?
         )`;

    const queryParams: (string | number)[] = [dateFrom, dateTo];
    if (!isAllTrainingProgrammes) {
      queryParams.push(courseId, courseId, courseId, courseId, courseId, courseId);
    }

    const [rows] = await pool.query<any[]>(
      `SELECT cm.Date_Added, cm.Comp_Name, cm.Contact_Person, cm.Designation,
               cm.Address, cm.City, cm.State, cm.Country, cm.Pin,
               cm.Tel, cm.Mobile, cm.EMail,
               cm.Course_Id1, cm.Course_Id2, cm.Course_Id3, cm.Course_Id4, cm.Course_Id5, cm.Course_Id6,
               c1.Course_Name AS Course_Name1, c2.Course_Name AS Course_Name2, c3.Course_Name AS Course_Name3,
               c4.Course_Name AS Course_Name4, c5.Course_Name AS Course_Name5, c6.Course_Name AS Course_Name6
       FROM consultant_mst cm
       LEFT JOIN course_mst c1 ON c1.Course_Id = cm.Course_Id1
       LEFT JOIN course_mst c2 ON c2.Course_Id = cm.Course_Id2
       LEFT JOIN course_mst c3 ON c3.Course_Id = cm.Course_Id3
       LEFT JOIN course_mst c4 ON c4.Course_Id = cm.Course_Id4
       LEFT JOIN course_mst c5 ON c5.Course_Id = cm.Course_Id5
       LEFT JOIN course_mst c6 ON c6.Course_Id = cm.Course_Id6
       WHERE (cm.IsDelete = 0 OR cm.IsDelete IS NULL)
          AND DATE(cm.Date_Added) BETWEEN ? AND ?
          ${courseFilterSql}
       ORDER BY cm.Date_Added DESC, cm.Comp_Name ASC`,
      queryParams
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIT Manager';
    wb.created = new Date();
    const ws = wb.addWorksheet('Consultancy by Training Programme', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });

    const headers: string[] = [
      'Created Date',
      'Company Name',
      'Contact Person Name',
      'Designation',
      'Company Address',
      'Contact Number',
      'Email Id',
    ];
    if (isAllTrainingProgrammes) {
      headers.splice(2, 0, 'Training Programmes');
    }
    const colCount = headers.length;

    const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB0B0B0' } };
    const allBorders: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Consultancy Report — Training Programme';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, colCount);
    const subCell = ws.getCell('A2');
    subCell.value = `Training Programme: ${courseName}   |   Period: ${dateFrom} to ${dateTo}   |   Total Records: ${rows.length}`;
    subCell.font = { italic: true, size: 11, color: { argb: 'FF2E3093' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    ws.getRow(2).height = 20;

    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6BB5' } };
      c.border = allBorders;
    });
    headerRow.height = 24;

    const formatDate = (v: any): string => {
      if (!v) return '';
      try {
        const d = v instanceof Date ? v : new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      } catch {
        return String(v);
      }
    };

    const joinAddress = (r: any): string => {
      const parts = [r.Address, r.City, r.State, r.Country, r.Pin]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter((p) => p.length > 0);
      return parts.join(', ');
    };

    const contactNumber = (r: any): string => {
      const mob = (r.Mobile || '').toString().trim();
      const tel = (r.Tel || '').toString().trim();
      if (mob && tel && mob !== tel) return `${mob} / ${tel}`;
      return mob || tel || '';
    };

    const resolveTrainingProgrammes = (r: any): string => {
      const names = [
        r.Course_Name1, r.Course_Name2, r.Course_Name3, r.Course_Name4, r.Course_Name5, r.Course_Name6,
      ].map((v: unknown) => (v == null ? '' : String(v).trim())).filter(Boolean);

      if (names.length > 0) return Array.from(new Set(names)).join(', ');

      const rawIds = [r.Course_Id1, r.Course_Id2, r.Course_Id3, r.Course_Id4, r.Course_Id5, r.Course_Id6]
        .map((v: unknown) => (v == null ? '' : String(v).trim()))
        .filter((v: string) => v && v !== '0');
      return Array.from(new Set(rawIds)).map((id) => `Programme ${id}`).join(', ');
    };

    rows.forEach((r, idx) => {
      const row = ws.getRow(4 + idx);
      const values: string[] = [
        formatDate(r.Date_Added),
        r.Comp_Name || '',
      ];
      if (isAllTrainingProgrammes) {
        values.push(resolveTrainingProgrammes(r));
      }
      values.push(
        r.Contact_Person || '',
        r.Designation || '',
        joinAddress(r),
        contactNumber(r),
        r.EMail || '',
      );
      values.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = allBorders;
      });
      if (idx % 2 === 1) {
        row.eachCell({ includeEmpty: true }, (c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
        });
      }
    });

    if (rows.length === 0) {
      const r = ws.getRow(4);
      ws.mergeCells(4, 1, 4, colCount);
      const c = r.getCell(1);
      c.value = 'No records found for the selected training programme and date range.';
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.font = { italic: true, color: { argb: 'FF888888' } };
    }

    const colWidths = isAllTrainingProgrammes
      ? [14, 28, 32, 22, 20, 36, 20, 28]
      : [14, 32, 22, 20, 42, 20, 28];
    colWidths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const safeCourse = courseName.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'course';
    const fileName = `Consultancy_${safeCourse}_${dateFrom}_to_${dateTo}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    console.error('Consultancy export-by-course error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
