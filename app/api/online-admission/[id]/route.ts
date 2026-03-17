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
    const { id: admissionId } = await params;

    // Fetch admission and student details
    const [rows] = await pool.query<any[]>(
      `SELECT 
        a.Admission_Id,
        a.Student_Id,
        a.Batch_Id,
        a.Course_Id,
        a.Admission_Date,
        s.Student_Name,
        s.Email,
        s.Present_Mobile,
        s.Present_Mobile2,
        s.Present_Address,
        s.Present_City,
        s.Present_PIN,
        s.Nationality,
        s.DOB,
        s.Sex,
        s.Status_id,
        b.Batch_code
      FROM admission_master a
      LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE a.Admission_Id = ? AND a.IsDelete = 0`,
      [admissionId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
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
      familyContact: '',
      presentAddress: admission.Present_Address || '',
      presentCity: admission.Present_City || '',
      presentPin: admission.Present_PIN || '',
      permanentAddress: '',
      permanentState: '',
      permanentCountry: 'India',
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
      occupationalStatus: '',
      jobOrganisation: '',
      jobDescription: '',
      jobDesignation: '',
      workingFromYears: '',
      workingFromMonths: '',
      totalOccupationYears: '',
      selfEmploymentDetails: '',
      trainingCategory: '',
      batchCode: admission.Batch_code || '',
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
    const { id: admissionId } = await params;
    const body = await req.json();

    // Fetch the student_id for this admission
    const [admissionRows] = await pool.query<any[]>(
      'SELECT Student_Id, Batch_Id FROM admission_master WHERE Admission_Id = ? AND IsDelete = 0',
      [admissionId]
    );

    if (!admissionRows || admissionRows.length === 0) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
    }

    const studentId = admissionRows[0].Student_Id;

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
        Present_PIN = ?,
        Nationality = ?,
        DOB = ?,
        Sex = ?,
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
        body.nationality || 'Indian',
        body.dob || null,
        body.gender || null,
        studentId,
      ]
    );

    // Update admission_master if needed
    await pool.query(
      `UPDATE admission_master SET
        Modified_Date = NOW()
      WHERE Admission_Id = ?`,
      [admissionId]
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
    const { id: admissionId } = await params;

    // Soft delete
    await pool.query(
      'UPDATE admission_master SET IsDelete = 1, Modified_Date = NOW() WHERE Admission_Id = ?',
      [admissionId]
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
