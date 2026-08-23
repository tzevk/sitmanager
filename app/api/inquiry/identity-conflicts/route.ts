/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    const [rows] = await pool.query(
      `SELECT
         cf.Id, cf.Inquiry_Id, cf.Mobile_Person_Id, cf.Email_Person_Id,
         cf.Incoming_Mobile, cf.Incoming_Email, cf.Created_At,
         si.Student_Name AS EnquiryName, si.Inquiry_Dt, c.Course_Name AS CourseName,
         mp.Name AS MobilePersonName, mp.Mobile AS MobilePersonMobile, mp.Email AS MobilePersonEmail,
         ep.Name AS EmailPersonName, ep.Mobile AS EmailPersonMobile, ep.Email AS EmailPersonEmail
       FROM person_identity_conflicts cf
       LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = cf.Inquiry_Id
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
       LEFT JOIN person_master mp ON mp.Person_Id = cf.Mobile_Person_Id
       LEFT JOIN person_master ep ON ep.Person_Id = cf.Email_Person_Id
       WHERE cf.Status = 'pending'
       ORDER BY cf.Created_At DESC`
    );

    return NextResponse.json({ conflicts: rows as any[] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Identity conflicts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch identity conflicts', details: message }, { status: 500 });
  }
}
