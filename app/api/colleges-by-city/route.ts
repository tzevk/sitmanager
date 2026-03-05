/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');

    // If city is provided, fetch colleges for that city
    if (city) {
      const [colleges] = await pool.query(
        `SELECT DISTINCT college_name 
         FROM awt_college 
         WHERE city = ? AND (deleted = 0 OR deleted IS NULL) AND college_name IS NOT NULL AND college_name != ''
         ORDER BY college_name`,
        [city]
      );
      
      const collegeList = (colleges as any[]).map(c => c.college_name);
      return NextResponse.json({ colleges: collegeList });
    }

    // If no city provided, fetch all distinct cities
    const [cities] = await pool.query(
      `SELECT DISTINCT city 
       FROM awt_college 
       WHERE (deleted = 0 OR deleted IS NULL) AND city IS NOT NULL AND city != ''
       ORDER BY city`
    );
    
    const cityList = (cities as any[]).map(c => c.city);
    return NextResponse.json({ cities: cityList });
  } catch (err: unknown) {
    console.error('Colleges by city API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
