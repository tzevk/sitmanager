/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

let tableReady = false;

async function ensureChangelogTable(pool: ReturnType<typeof getPool>) {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS software_changelog (
      Id INT NOT NULL AUTO_INCREMENT,
      Title VARCHAR(255) NOT NULL,
      Description TEXT NULL,
      Category VARCHAR(30) NOT NULL DEFAULT 'Update',
      Commit_Hash VARCHAR(64) NULL,
      Author VARCHAR(100) NULL,
      Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (Id),
      UNIQUE KEY uq_changelog_commit (Commit_Hash),
      INDEX idx_changelog_created (Created_Date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'changelog.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureChangelogTable(pool);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50));

    const [rows] = await pool.query<any[]>(
      `SELECT Id, Title, Description, Category, Author, Created_Date
       FROM software_changelog
       ORDER BY Created_Date DESC, Id DESC
       LIMIT ?`,
      [limit]
    );

    return NextResponse.json({ success: true, entries: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'changelog.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureChangelogTable(pool);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? '').trim();
    const description = String(body?.description ?? '').trim() || null;
    const category = String(body?.category ?? 'Update').trim() || 'Update';

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 });
    }

    const authorName = `${auth.session.firstName ?? ''} ${auth.session.lastName ?? ''}`.trim() || null;

    await pool.query(
      `INSERT INTO software_changelog (Title, Description, Category, Author)
       VALUES (?, ?, ?, ?)`,
      [title, description, category, authorName]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
