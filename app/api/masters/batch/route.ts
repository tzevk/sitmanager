/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';

    /* ---- Build WHERE ---- */
    const conditions: string[] = [
      'b.IsActive = 1',
      '(b.IsDelete = 0 OR b.IsDelete IS NULL)',
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR b.Category LIKE ? OR b.Training_Coordinator LIKE ?)`
      );
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (category) {
      conditions.push('b.Category = ?');
      params.push(category);
    }

    const where = conditions.join(' AND ');

    /* ---- Count ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${where}
    `;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data ---- */
    const dataSql = `
      SELECT
        b.Batch_Id AS id,
        b.Batch_code AS batchNo,
        c.Course_Name AS courseName,
        b.Category AS category,
        b.Timings AS timings,
        b.SDate AS plannedStartDate,
        b.Admission_Date AS lastDateOfAdmission,
        b.Training_Coordinator AS trainingCoordinator
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${where}
      ORDER BY b.Batch_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch API error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Course_Id, Batch_code, Category, Timings, SDate, EDate,
      Admission_Date, Duration, Training_Coordinator,
      Min_Qualification, Documents_Required, Passing_Criteria,
      Max_Students, Course_description, CourseName, Comments,
      NoStudent,
      INR_Basic, INR_ServiceTax, INR_Total,
      Dollar_Basic, Dollar_ServiceTax, Dollar_Total,
      Actual_Fees_Payment, Fees_Full_Payment, Fees_Installment_Payment,
    } = body;

    if (!Course_Id) {
      return NextResponse.json({ error: 'Course Name is required' }, { status: 400 });
    }
    if (!Min_Qualification?.toString().trim()) {
      return NextResponse.json({ error: 'Eligibility is required' }, { status: 400 });
    }
    if (!Max_Students?.toString().trim()) {
      return NextResponse.json({ error: 'Target Student is required' }, { status: 400 });
    }
    if (!Documents_Required?.toString().trim()) {
      return NextResponse.json({ error: 'Documents Required is required' }, { status: 400 });
    }
    if (!Passing_Criteria?.toString().trim()) {
      return NextResponse.json({ error: 'Passing Criteria is required' }, { status: 400 });
    }
    if (!Course_description?.toString().trim()) {
      return NextResponse.json({ error: 'Brief Description is required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO batch_mst (
        Course_Id, Batch_code, Category, Timings, SDate, EDate,
        Admission_Date, Duration, Training_Coordinator,
        Min_Qualification, Documents_Required, Passing_Criteria,
        Max_Students, Course_description, CourseName, Comments,
        NoStudent,
        INR_Basic, INR_ServiceTax, INR_Total,
        Dollar_Basic, Dollar_ServiceTax, Dollar_Total,
        Actual_Fees_Payment, Fees_Full_Payment, Fees_Installment_Payment,
        IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `;
    const [result] = await pool.query<any>(sql, [
      Course_Id ? Number(Course_Id) : null,
      Batch_code?.trim() || null,
      Category?.trim() || null,
      Timings?.trim() || null,
      SDate || null,
      EDate || null,
      Admission_Date || null,
      Duration?.trim() || null,
      Training_Coordinator?.trim() || null,
      Min_Qualification?.trim(),
      Documents_Required?.trim(),
      Passing_Criteria?.trim(),
      Max_Students?.toString().trim() || null,
      Course_description?.trim(),
      CourseName?.trim() || null,
      Comments?.trim() || null,
      NoStudent ? Number(NoStudent) : null,
      INR_Basic ? Number(INR_Basic) : null,
      INR_ServiceTax ? Number(INR_ServiceTax) : null,
      INR_Total ? Number(INR_Total) : null,
      Dollar_Basic ? Number(Dollar_Basic) : null,
      Dollar_ServiceTax ? Number(Dollar_ServiceTax) : null,
      Dollar_Total ? Number(Dollar_Total) : null,
      Actual_Fees_Payment ? Number(Actual_Fees_Payment) : null,
      Fees_Full_Payment ? Number(Fees_Full_Payment) : null,
      Fees_Installment_Payment ? Number(Fees_Installment_Payment) : null,
    ]);

    return NextResponse.json({
      success: true,
      Batch_Id: result.insertId,
      message: 'Batch created successfully',
    });
  } catch (err: unknown) {
    console.error('Batch POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
