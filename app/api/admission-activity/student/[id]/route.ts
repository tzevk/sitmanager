/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch single student with all related data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;

    // Student + admission + batch + course
    const [rows] = await pool.query<any[]>(
      `SELECT
         s.*,
         a.Admission_Id, a.Batch_Id, a.Admission_Date,
         b.Batch_code,
         b.SDate AS Batch_StartDate,
         b.EDate AS Batch_EndDate,
         c.Course_Name,
         st.Status AS Status_name
       FROM student_master s
       LEFT JOIN admission_master a
         ON s.Student_Id = a.Student_Id AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
       LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
       LEFT JOIN status_master st ON s.Status_id = st.Id
       WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Placement records — CV shortlist children for this student
    const [placement] = await pool.query<any[]>(
      `SELECT cc.*, cv.CompanyName, cv.TDate AS ShortlistDate, b.Batch_Code, c.Course_Name
       FROM cvchild cc
       LEFT JOIN cv_shortlisted cv ON cc.CV_Id = cv.id
       LEFT JOIN batch_mst b ON cc.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON cv.Course_id = c.Course_Id
       WHERE cc.Student_Id = ? AND (cc.IsDelete = 0 OR cc.IsDelete IS NULL)
       ORDER BY cc.id DESC`,
      [id]
    );

    // Discussions
    const [discussions] = await pool.query<any[]>(
      `SELECT id, date, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE Inquiry_id = ? AND deleted = 0
       ORDER BY id DESC`,
      [id]
    );

    // Dropdown options
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name FROM course_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
    );
    const [batches] = await pool.query<any[]>(
      `SELECT Batch_Id, Batch_code, Course_Id FROM batch_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Batch_code DESC`
    );
    const [statuses] = await pool.query<any[]>(
      `SELECT Id AS id, Status AS label FROM status_master WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id`
    );
    const [batchCategories] = await pool.query<any[]>(
      `SELECT DISTINCT Category AS label FROM batch_mst
       WHERE Category IS NOT NULL AND Category != ''
         AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Category`
    );

    return NextResponse.json({
      student: rows[0],
      placement,
      discussions,
      courses,
      batches,
      statuses,
      batchCategories,
    });
  } catch (err: unknown) {
    console.error('Student GET [id] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update student record
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const body = await req.json();

    const {
      // Personal
      FName, MName, LName, Student_Name,
      DOB, Sex, Nationality,
      Email, Present_Mobile, Telephone,
      Present_Address, Present_City, Present_State, Present_Pin, Present_Country,
      Permanent_Address, Permanent_State, Permanent_Country,
      // Academic
      Qualification, Discipline, Percentage, Course_Id,
      Batch_Code, Batch_code, Batch_Category_id,
      // Company / Occupational
      Organisation, Designation, JobDescription, WorkingSince, TotalExperience, OccupationalStatus,
      // Inquiry meta
      Inquiry_From, Inquiry_Type, Inquiry_Dt,
      // Status
      Status_id,
    } = body;

    const fullName = Student_Name ||
      [FName, MName, LName].filter(Boolean).join(' ') || null;

    await pool.query(
      `UPDATE student_master SET
         Student_Name = ?,
         FName = ?,
         MName = ?,
         LName = ?,
         DOB = ?,
         Sex = ?,
         Nationality = ?,
         Email = ?,
         Present_Mobile = ?,
         Present_Mobile2 = ?,
         Present_Address = ?,
         Present_City = ?,
         Present_State = ?,
         Present_Pin = ?,
         Present_Country = ?,
         Permanent_Address = ?,
         Permanent_State = ?,
         Permanent_Country = ?,
         Qualification = ?,
         Discipline = ?,
         Percentage = ?,
         Course_Id = ?,
         Batch_Code = ?,
         Batch_Category_id = ?,
         Organisation = ?,
         Designation = ?,
         OccupationalStatus = ?,
         WorkingSince = ?,
         TotalExperience = ?,
         JobDescription = ?,
         Inquiry_From = ?,
         Inquiry_Type = ?,
         Inquiry_Dt = ?,
         Status_id = ?
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [
        fullName,
        FName || null,
        MName || null,
        LName || null,
        DOB || null,
        Sex || null,
        Nationality || null,
        Email || null,
        Present_Mobile || null,
        Telephone || null,
        Present_Address || null,
        Present_City || null,
        Present_State || null,
        Present_Pin || null,
        Present_Country || null,
        Permanent_Address || null,
        Permanent_State || null,
        Permanent_Country || null,
        Qualification || null,
        Discipline || null,
        Percentage ? parseFloat(Percentage) : null,
        Course_Id ? parseInt(Course_Id) : null,
        Batch_Code || Batch_code || null,
        Batch_Category_id || null,
        Organisation || null,
        Designation || null,
        OccupationalStatus || null,
        WorkingSince || null,
        TotalExperience || null,
        JobDescription || null,
        Inquiry_From || null,
        Inquiry_Type || null,
        Inquiry_Dt || null,
        Status_id ? parseInt(Status_id) : null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
