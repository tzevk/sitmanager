/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * Public endpoint — no auth required.
 * Returns only the fields needed to pre-fill the online admission form.
 * Deliberately omits status, discussion notes, and internal fields.
 */
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const inquiryId = req.nextUrl.searchParams.get('id');

    if (!inquiryId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const idNum = parseInt(inquiryId, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT
         si.Inquiry_Id   AS Student_Id,
         si.Student_Name,
         si.Email,
         si.Present_Mobile,
         si.Present_Mobile2,
         si.DOB,
         si.Sex,
         si.Nationality,
         si.Present_Country,
         si.Course_Id,
         c.Course_Name   AS CourseName,
         si.Batch_Code,
         si.Qualification,
         si.Discipline,
         si.Percentage
       FROM Student_Inquiry si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       WHERE si.Inquiry_Id = ?
         AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
      [idNum]
    );

    const row = (rows as any[])[0];
    if (!row) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Normalize DOB — MySQL2 can return DATE columns as JS Date objects.
    // The admission form expects YYYY-MM-DD string.
    let dob = '';
    if (row.DOB) {
      if (row.DOB instanceof Date) {
        dob = row.DOB.toISOString().slice(0, 10);
      } else {
        dob = String(row.DOB).slice(0, 10);
      }
    }

    return NextResponse.json({
      inquiry: {
        Student_Id:      row.Student_Id,
        Student_Name:    row.Student_Name   || '',
        Email:           row.Email          || '',
        Present_Mobile:  row.Present_Mobile || '',
        Present_Mobile2: row.Present_Mobile2|| '',
        DOB:             dob,
        Sex:             row.Sex            || '',
        Nationality:     row.Nationality    || '',
        Present_Country: row.Present_Country|| '',
        Course_Id:       row.Course_Id      ?? null,
        CourseName:      row.CourseName     || '',
        Batch_Code:      row.Batch_Code     || '',
        Qualification:   row.Qualification  || '',
        Discipline:      row.Discipline     || '',
        Percentage:      row.Percentage     ?? null,
      },
    });
  } catch (error: any) {
    console.error('Public inquiry GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inquiry', details: error.message },
      { status: 500 }
    );
  }
}
