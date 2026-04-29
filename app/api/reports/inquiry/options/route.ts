/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();

    const [coursesRes, typesRes, fromRes, categoriesRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT c.Course_Id as id, c.Course_Name as name
         FROM Student_Inquiry si
         JOIN course_mst c ON si.Course_Id = c.Course_Id
         WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
           AND c.Course_Name IS NOT NULL AND c.Course_Name != ''
         ORDER BY c.Course_Name`
      ),
      pool.query(
        `SELECT DISTINCT Inquiry_Type
         FROM Student_Inquiry
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND Inquiry_Type IS NOT NULL AND TRIM(Inquiry_Type) != ''
         ORDER BY Inquiry_Type`
      ),
      pool.query(
        `SELECT DISTINCT Inquiry_From
         FROM Student_Inquiry
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND Inquiry_From IS NOT NULL AND TRIM(Inquiry_From) != ''
         ORDER BY Inquiry_From`
      ),
      pool.query(
        `SELECT DISTINCT b.Category
         FROM Student_Inquiry si
         JOIN batch_mst b ON si.Batch_Code = b.Batch_Id
         WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
           AND b.Category IS NOT NULL AND b.Category != ''
         ORDER BY b.Category`
      ),
    ]);

    return NextResponse.json({
      courses:      (coursesRes[0]    as any[]).map((r) => ({ id: r.id, name: r.name })),
      inquiryTypes: (typesRes[0]      as any[]).map((r) => r.Inquiry_Type),
      inquiryModes: (fromRes[0]       as any[]).map((r) => r.Inquiry_From),
      categories:   (categoriesRes[0] as any[]).map((r) => r.Category),
    });
  } catch (error: any) {
    console.error('Report inquiry options error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options', details: error.message },
      { status: 500 }
    );
  }
}
