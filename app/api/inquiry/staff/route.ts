import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// Staff logins for "account name" dropdowns on the inquiry form.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const staff = await cached('inquiry-staff-options-v1', 300, async () => {
      const [rows] = await getPool().query(
        `SELECT id,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))), ''), username) AS name
         FROM awt_adminuser
         WHERE (deleted = 0 OR deleted IS NULL)
         ORDER BY name`
      );
      return (rows as { id: number; name: string | null }[]).filter((r) => r.name);
    });
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Inquiry staff GET error:', error);
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
}
