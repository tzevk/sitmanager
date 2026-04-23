/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sendPublicInquirySubmissionEmail } from '@/lib/mailer';

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

function normalizeDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return raw || null;
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.trunc(num) : null;
}

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({}));

    const studentName = normalizeText(body?.Student_Name);
    const inquiryType = normalizeText(body?.Inquiry_Type);
    const courseName = normalizeText(body?.Course_Name);
    let courseId = parsePositiveInt(body?.Course_Id);
    const qualification = normalizeText(body?.Qualification);
    const discipline = normalizeText(body?.Discipline);
    const percentage = body?.Percentage === '' || body?.Percentage === null || body?.Percentage === undefined
      ? null
      : Number(body?.Percentage);
    const gender = normalizeText(body?.Sex);
    const dob = normalizeDateOnly(body?.DOB);
    const nationality = normalizeText(body?.Nationality);
    const mobile = normalizeText(body?.Present_Mobile);
    const email = normalizeText(body?.Email);
    const notes = normalizeText(body?.Discussion);
    const source = normalizeText(body?.Inquiry_From);

    if (!studentName) {
      return NextResponse.json({ success: false, error: 'Full name is required' }, { status: 400 });
    }
    if (!qualification) {
      return NextResponse.json({ success: false, error: 'Academic qualification is required' }, { status: 400 });
    }
    if (!discipline) {
      return NextResponse.json({ success: false, error: 'Discipline is required' }, { status: 400 });
    }
    if (percentage === null || !Number.isFinite(percentage)) {
      return NextResponse.json({ success: false, error: 'Percentage is required' }, { status: 400 });
    }
    if (!mobile) {
      return NextResponse.json({ success: false, error: 'Mobile number is required' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email address is required' }, { status: 400 });
    }

    if (!courseId && courseName) {
      const [courseRows] = await pool.query(
        `SELECT Course_Id
         FROM course_mst
         WHERE Course_Name = ?
         LIMIT 1`,
        [courseName]
      );
      courseId = parsePositiveInt((courseRows as any[])[0]?.Course_Id);
    }

    const [result] = await pool.query(
      `INSERT INTO Student_Inquiry (
        Student_Name, Sex, DOB, Present_Mobile, Email,
        Nationality, Discussion, OnlineState, Inquiry_Dt, Inquiry_From, Inquiry_Type,
        Course_Id, Qualification, Discipline, Percentage,
        IsDelete, Inquiry, Date_Added
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, 0, 'Inquiry', NOW())`,
      [
        studentName,
        gender,
        dob,
        mobile,
        email,
        nationality,
        notes,
        1,
        source,
        inquiryType,
        courseId,
        qualification,
        discipline,
        percentage,
      ]
    );

    const insertedId = (result as any).insertId;

    try {
      await sendPublicInquirySubmissionEmail({
        toEmail: email,
        studentName,
        inquiryId: insertedId,
      });
    } catch (mailError) {
      console.error('Public inquiry thank-you email error:', mailError);
    }

    return NextResponse.json({
      success: true,
      Student_Id: insertedId,
      message: 'Enquiry submitted successfully',
    });
  } catch (error: any) {
    console.error('Public inquiry POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit enquiry', details: error.message },
      { status: 500 }
    );
  }
}
