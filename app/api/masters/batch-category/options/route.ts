import { NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const batchTypes = await cached('batch-category-options', 300_000, async () => {
      const pool = getPool();

      // Fetch distinct batch types from mst_batchcategory table (primary master source)
      const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT DISTINCT Batch_Type AS batchtype
        FROM mst_batchcategory
        WHERE IsActive = 1
          AND (IsDelete IS NULL OR IsDelete = 0)
          AND Batch_Type IS NOT NULL
          AND Batch_Type != ''
        ORDER BY Batch_Type
      `);

      let types = rows.map((r) => r.batchtype);

      // Fallback: if no batch types in mst_batchcategory, fetch from batch_mst.Category
      if (types.length === 0) {
        const [catRows] = await pool.query<RowDataPacket[]>(`
          SELECT DISTINCT Category 
          FROM batch_mst 
          WHERE IsActive = 1 
            AND (IsDelete = 0 OR IsDelete IS NULL)
            AND Category IS NOT NULL 
            AND Category != '' 
          ORDER BY Category
        `);
        types = catRows.map((r) => r.Category);
      }

      return types;
    });

    return NextResponse.json({ batchTypes }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err: unknown) {
    console.error('Batch Category Options API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
