/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.create');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const body = await req.json();

    const {
      Student_Id,
      fullName,
      shortName,
      dob,
      gender,
      nationality,
      email,
      mobile,
      // telephone, // Captured but not stored in current schema
      // familyContact, // Captured but not stored in current schema
      presentAddress,
      presentCity,
      presentPin,
      permanentAddress,
      permanentState,
      permanentCountry,
      degree,
      discipline,
      // college, // Captured but not stored in current schema
      // university, // Captured but not stored in current schema
      // yearOfPassing, // Captured but not stored in current schema
      marks,
      // status, // Captured but not stored in current schema
      // totalBacklogs, // Captured but not stored in current schema
      // remark, // Captured but not stored in current schema
      // occupationalStatus, // Captured but not stored in current schema
      // trainingCategory, // Captured but not stored in current schema
      batchCode,
      // idProofType, // Captured but not stored in current schema
    } = body;

    if (!Student_Id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    // Update student_master with admission form data
    const updateStudentSql = `
      UPDATE student_master SET
        Student_Name = ?,
        FName = ?,
        Sex = ?,
        DOB = ?,
        Nationality = ?,
        Email = ?,
        Present_Mobile = ?,
        Present_Address = ?,
        Present_City = ?,
        Present_Pin = ?,
        Permanent_Address = ?,
        Permanent_State = ?,
        Permanent_Country = ?,
        Qualification = ?,
        Discipline = ?,
        Percentage = ?,
        Status_id = 8
      WHERE Student_Id = ?
    `;

    await pool.query(updateStudentSql, [
      fullName?.trim() || null,
      shortName?.trim() || null,
      gender || null,
      dob || null,
      nationality || null,
      email?.trim() || null,
      mobile || null,
      presentAddress || null,
      presentCity || null,
      presentPin || null,
      permanentAddress || null,
      permanentState || null,
      permanentCountry || null,
      degree || null,
      discipline || null,
      marks ? parseFloat(marks) : null,
      Student_Id,
    ]);

    // Get batch information
    let batchId = null;
    if (batchCode) {
      const [batchRows] = await pool.query<any[]>(
        'SELECT Batch_Id FROM batch_mst WHERE Batch_code = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1',
        [batchCode]
      );
      if (batchRows.length > 0) {
        batchId = batchRows[0].Batch_Id;
      }
    }

    // Check if admission already exists
    const [existingAdmission] = await pool.query<any[]>(
      'SELECT Admission_Id FROM admission_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)',
      [Student_Id]
    );

    let admissionId;
    
    if (existingAdmission.length > 0) {
      // Update existing admission
      admissionId = existingAdmission[0].Admission_Id;
      await pool.query(
        `UPDATE admission_master SET
          Batch_Id = ?,
          Admission_Date = NOW(),
          IsActive = 1,
          Cancel = 0
        WHERE Admission_Id = ?`,
        [batchId, admissionId]
      );
    } else {
      // Create new admission record
      const [admissionResult] = await pool.query(
        `INSERT INTO admission_master (
          Student_Id,
          Batch_Id,
          Admission_Date,
          IsActive,
          Cancel,
          IsDelete,
          created_date
        ) VALUES (?, ?, NOW(), 1, 0, 0, NOW())`,
        [Student_Id, batchId]
      );
      admissionId = (admissionResult as any).insertId;
    }

    // Store additional form data in a dedicated table (if exists)
    // For now, we'll store additional details as JSON in a comment or separate table
    // You may want to create an admission_details table for these fields

    return NextResponse.json({
      success: true,
      admissionId,
      message: 'Admission form submitted successfully',
    });
  } catch (err: unknown) {
    console.error('Admission form submission error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Fetch admission form data for editing
export async function GET(req: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Fetch student and admission data
    const [rows] = await pool.query<any[]>(
      `SELECT 
        s.*,
        a.Admission_Id,
        a.Batch_Id,
        a.Admission_Date,
        b.Batch_code
      FROM student_master s
      LEFT JOIN admission_master a ON s.Student_Id = a.Student_Id AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [studentId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (err: unknown) {
    console.error('Admission form GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
