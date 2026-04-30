import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const sql = `
      SELECT
        b.Batch_Id, b.Batch_code, b.Category, b.Timings,
        b.No_of_Lectures,
        IFNULL(b.UnitTestWtg, 0) AS UnitTestWtg,
        IFNULL(b.AssignWtg, 0)   AS AssignWtg,
        IFNULL(b.ExamWtg, 0)     AS ExamWtg,
        IFNULL(b.AttendWtg, 0)   AS AttendWtg,
        c.Course_Name, c.Course_Id,
        b.SDate, b.EDate,
        b.Passing_Criteria,
        b.Admission_Date, b.ActualDate, b.Duration, b.Training_Coordinator,
        b.Min_Qualification, b.Documents_Required,
        b.Fees_Full_Payment, b.Fees_Installment_Payment, b.Actual_Fees_Payment,
        b.Max_Students, b.Course_description, b.Corporate,
        b.ConvocationDate, b.Convocationday,
        b.FullAttendWtg, b.INR_Basic, b.INR_ServiceTax,
        b.INR_Total, b.Dollar_Basic, b.Dollar_ServiceTax, b.Dollar_Total,
        b.TaxRate, b.Site_Visit_Dt, b.Site_company, b.Site_Place,
        b.Contact_Person, b.Designation, b.Telephone, b.Comments, b.LateMarkLimit,
        b.CourseName, b.NoStudent, b.Attachment
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE b.Batch_Id = ?
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>(sql, [id]);

    if (!rows.length) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch [id] GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;
    const body = await req.json();

    // Build dynamic update query based on provided fields
    const allowedFields = [
      'Course_Id', 'Batch_code', 'Category', 'Timings', 'SDate', 'EDate',
      'Admission_Date', 'ActualDate', 'Duration', 'Training_Coordinator',
      'Min_Qualification', 'Documents_Required', 'Passing_Criteria',
      'Fees_Full_Payment', 'Fees_Installment_Payment', 'Actual_Fees_Payment',
      'No_of_Lectures', 'Max_Students', 'Course_description', 'Corporate',
      'ConvocationDate', 'Convocationday', 'AttendWtg', 'AssignWtg',
      'ExamWtg', 'UnitTestWtg', 'FullAttendWtg', 'INR_Basic', 'INR_ServiceTax',
      'INR_Total', 'Dollar_Basic', 'Dollar_ServiceTax', 'Dollar_Total',
      'TaxRate', 'Site_Visit_Dt', 'Site_company', 'Site_Place',
      'Contact_Person', 'Designation', 'Telephone', 'Comments', 'LateMarkLimit',
      'CourseName', 'NoStudent'
    ];

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field] === '' ? null : body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    const sql = `UPDATE batch_mst SET ${updates.join(', ')} WHERE Batch_Id = ?`;
    await pool.query(sql, values);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch [id] PUT error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
