/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();

    const options = await cached('inquiry-form-options', 300, async () => {
      const [
        coursesRes,
        categoriesRes,
        qualificationsRes,
        disciplinesRes,
        nationalitiesRes,
        countriesRes,
      ] = await Promise.all([
        pool.query(
          "SELECT Course_Id, Course_Name FROM course_mst WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name"
        ),
        pool.query(
          "SELECT DISTINCT Category FROM batch_mst WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) AND Category IS NOT NULL AND Category != '' ORDER BY Category"
        ),
        pool.query(
          "SELECT DISTINCT Qualification FROM student_master WHERE Qualification IS NOT NULL AND Qualification != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Qualification"
        ),
        pool.query(
          "SELECT DISTINCT Discipline FROM student_master WHERE Discipline IS NOT NULL AND Discipline != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Discipline"
        ),
        pool.query(
          "SELECT DISTINCT Nationality FROM student_master WHERE Nationality IS NOT NULL AND Nationality != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Nationality"
        ),
        pool.query(
          "SELECT DISTINCT Present_Country FROM student_master WHERE Present_Country IS NOT NULL AND Present_Country != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Present_Country"
        ),
      ]);

      const courses = (coursesRes[0] as any[]).map((r) => ({
        id: r.Course_Id,
        name: r.Course_Name,
      }));
      const categories = (categoriesRes[0] as any[]).map((r) => r.Category);
      const qualifications = (qualificationsRes[0] as any[]).map((r) => r.Qualification);
      const disciplines = (disciplinesRes[0] as any[]).map((r) => r.Discipline);
      const nationalities = (nationalitiesRes[0] as any[]).map((r) => r.Nationality);
      const countries = (countriesRes[0] as any[]).map((r) => r.Present_Country);

      // Statuses (hardcoded since awt_status is empty)
      const statuses = [
        { id: 1, label: 'New' },
        { id: 2, label: 'Contacted' },
        { id: 3, label: 'Inquiry' },
        { id: 4, label: 'Follow Up' },
        { id: 5, label: 'Interested' },
        { id: 6, label: 'Not Interested' },
        { id: 7, label: 'Admitted' },
        { id: 8, label: 'Closed' },
        { id: 9, label: 'DNC' },
        { id: 10, label: 'Converted' },
        { id: 12, label: 'Pending' },
        { id: 15, label: 'Callback' },
        { id: 16, label: 'Visited' },
        { id: 18, label: 'On Hold' },
        { id: 19, label: 'Lost' },
        { id: 24, label: 'Hot Lead' },
        { id: 25, label: 'Warm Lead' },
        { id: 26, label: 'Cold Lead' },
        { id: 27, label: 'Enrolled' },
        { id: 29, label: 'Dropped' },
        { id: 33, label: 'Archived' },
      ];

      const genders = ['Male', 'Female'];

      const inquiryModes = [
        'Phone',
        'Mail',
        'Personal',
        'Website',
        'Reference',
        'Exhibition',
        'College Visit',
        'Emagister',
        'Shiksha.com',
        'Online Mail',
      ];

      const inquiryTypes = [
        'Advertisement',
        'Reference',
        'Website',
        'Google',
        'Facebook',
        'Exhibition',
        'Ex-Student',
        'Emagister',
        'India Mart',
        'News Paper',
        'Seminar',
        'Shiksha',
        'TV Interview',
        'Import',
      ];

      return {
        courses,
        categories,
        qualifications,
        disciplines,
        nationalities,
        countries,
        statuses,
        genders,
        inquiryModes,
        inquiryTypes,
      };
    });

    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    console.error('Inquiry options API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options', details: error.message },
      { status: 500 }
    );
  }
}
