/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

type DisciplineGroup = { name: string; subtopics: string[] };

function uniqNonEmpty(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * GET — Topic options derived from planned lectures assigned to the trainer.
 * Query:
 * - batchId (required)
 * - month (optional, YYYY-MM)
 *
 * Returns:
 * - disciplines: [{ name, subtopics: [..] }]
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const month = searchParams.get('month');

    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    let dateFilter = '';
    const params: any[] = [batchId];
    if (month) {
      dateFilter = ` AND date LIKE ?`;
      params.push(`${month}%`);
    }

    // NOTE: We derive a "discipline" from subject/module (fallback), and subtopics from subject_topic.
    const [rows] = await pool.query<any[]>(
      `SELECT subject, module, subject_topic
       FROM batch_lecture_master
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL)${dateFilter}`,
      params
    );

    const groups = new Map<string, { display: string; subtopics: string[] }>();

    for (const r of rows) {
      const discipline = uniqNonEmpty([r?.subject, r?.module])[0] || 'General';
      const disciplineKey = discipline.toLowerCase();
      const subtopic = (r?.subject_topic ?? '').trim();

      if (!groups.has(disciplineKey)) {
        groups.set(disciplineKey, { display: discipline, subtopics: [] });
      }
      if (subtopic) groups.get(disciplineKey)!.subtopics.push(subtopic);
    }

    const disciplines: DisciplineGroup[] = Array.from(groups.values()).map(g => ({
      name: g.display,
      subtopics: uniqNonEmpty(g.subtopics),
    }));

    disciplines.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ disciplines });
  } catch (err: unknown) {
    console.error('Lecture topics error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
