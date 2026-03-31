/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;

    // Fetch admission and student details
    const [rows] = await pool.query<any[]>(
      `SELECT 
        a.Admission_Id,
        s.Student_Id,
        a.Batch_Id,
        a.Course_Id,
        a.Admission_Date,
        s.Student_Name,
        s.Email,
        s.Present_Mobile,
        s.Present_Mobile2,
        s.Present_Address,
        s.Present_City,
        s.Present_Pin,
        s.Present_State,
        s.Permanent_Address,
        s.Permanent_City,
        s.Permanent_Pin,
        s.Permanent_State,
        s.Permanent_Country,
        s.Nationality,
        s.DOB,
        s.Sex,
        s.Status_id,
        s.Occupation,
        s.Company,
        s.Designation,
        s.Total_Exp,
        s.Father_Mobile,
        s.Batch_Code as Student_Batch_Code,
        b.Batch_code as Admission_Batch_code
      FROM student_master s
      LEFT JOIN admission_master a ON s.Student_Id = a.Student_Id AND a.IsDelete = 0
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [studentId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const admission = rows[0];
    
    // Parse name parts
    const nameParts = (admission.Student_Name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    // Format response
    const response = {
      admissionId: admission.Admission_Id,
      studentId: admission.Student_Id,
      firstName,
      middleName,
      lastName,
      shortName: '',
      dob: admission.DOB ? new Date(admission.DOB).toISOString().split('T')[0] : '',
      gender: admission.Sex || '',
      nationality: admission.Nationality || 'Indian',
      email: admission.Email || '',
      mobile: admission.Present_Mobile || '',
      telephone: admission.Present_Mobile2 || '',
      familyContact: admission.Father_Mobile || '',
      presentAddress: admission.Present_Address || '',
      presentCity: admission.Present_City || '',
      presentPin: admission.Present_Pin || '',
      permanentAddress: admission.Permanent_Address || '',
      permanentState: admission.Permanent_State || '',
      permanentCountry: admission.Permanent_Country || 'India',
      // Educational fields (to be populated from additional tables if needed)
      ssc_board: '',
      ssc_schoolName: '',
      ssc_yearOfPassing: '',
      ssc_percentage: '',
      ssc_ktCount: '0',
      ssc_ktDetails: [],
      hsc_board: '',
      hsc_collegeName: '',
      hsc_stream: '',
      hsc_yearOfPassing: '',
      hsc_percentage: '',
      hsc_ktCount: '0',
      hsc_ktDetails: [],
      diploma_degree: '',
      diploma_specialization: '',
      diploma_institute: '',
      diploma_yearOfPassing: '',
      diploma_percentage: '',
      diploma_ktCount: '0',
      diploma_ktDetails: [],
      grad_degree: '',
      grad_specialization: '',
      grad_university: '',
      grad_yearOfPassing: '',
      grad_percentage: '',
      grad_ktCount: '0',
      grad_ktDetails: [],
      postgrad_degree: '',
      postgrad_specialization: '',
      postgrad_university: '',
      postgrad_yearOfPassing: '',
      postgrad_percentage: '',
      postgrad_ktCount: '0',
      postgrad_ktDetails: [],
      educationRemark: '',
      occupationalStatus: admission.Occupation || '',
      jobOrganisation: admission.Company || '',
      jobDescription: '',
      jobDesignation: admission.Designation || '',
      workingFromYears: '',
      workingFromMonths: '',
      totalOccupationYears: String(admission.Total_Exp || ''),
      selfEmploymentDetails: '',
      trainingCategory: '',
      batchCode: admission.Admission_Batch_code || admission.Student_Batch_Code || '',
      idProofType: '',
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.update');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;
    const body = await req.json();

    // Check if student exists
    const [studentRows] = await pool.query<any[]>(
      'SELECT Student_Id FROM student_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)',
      [studentId]
    );

    if (!studentRows || studentRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Construct full name
    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');

    // Update student_master
    await pool.query(
      `UPDATE student_master SET
        Student_Name = ?,
        Email = ?,
        Present_Mobile = ?,
        Present_Mobile2 = ?,
        Present_Address = ?,
        Present_City = ?,
        Present_Pin = ?,
        Present_State = ?,
        Permanent_Address = ?,
        Permanent_City = ?,
        Permanent_Pin = ?,
        Permanent_State = ?,
        Permanent_Country = ?,
        Nationality = ?,
        DOB = ?,
        Sex = ?,
        Occupation = ?,
        Company = ?,
        Designation = ?,
        Total_Exp = ?,
        Father_Mobile = ?,
        Modified_Date = NOW()
      WHERE Student_Id = ?`,
      [
        fullName,
        body.email,
        body.mobile,
        body.telephone || null,
        body.presentAddress || null,
        body.presentCity || null,
        body.presentPin || null,
        body.presentState || null,
        body.permanentAddress || null,
        body.permanentCity || null,
        body.permanentPin || null,
        body.permanentState || null,
        body.permanentCountry || 'India',
        body.nationality || 'Indian',
        body.dob || null,
        body.gender || null,
        body.occupationalStatus || null,
        body.jobOrganisation || null,
        body.jobDesignation || null,
        body.totalOccupationYears ? Number(body.totalOccupationYears) : 0,
        body.familyContact || null,
        studentId,
      ]
    );

    // Update admission_master if it exists for this student
    await pool.query(
      `UPDATE admission_master SET
        Modified_Date = NOW()
      WHERE Student_Id = ? AND IsDelete = 0`,
      [studentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Admission updated successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.delete');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;

    // Soft delete student_master
    await pool.query(
      'UPDATE student_master SET IsDelete = 1, Modified_Date = NOW() WHERE Student_Id = ?',
      [studentId]
    );

    // Soft delete associated admission if there is any
    await pool.query(
      'UPDATE admission_master SET IsDelete = 1, Modified_Date = NOW() WHERE Student_Id = ?',
      [studentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Admission deleted successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
