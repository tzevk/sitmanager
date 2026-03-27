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
 * GET — Topic options derived from the batch Standard Lecture Plan (Dashboard → Masters → Batch → Edit → Standard Lecture Plan).
 * Query:
 * - batchId (required)
 * - month (optional, YYYY-MM) (accepted for backward compatibility; currently not used)
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
    // const month = searchParams.get('month');

    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    // Primary source: Standard Lecture Plan (batch_slecture_master)
    const [stdRows] = await pool.query<any[]>(
      `SELECT lecturecontent, subject, subject_topic
       FROM batch_slecture_master
       WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0' OR deleted = 0)
       ORDER BY lecture_no ASC, date ASC, id ASC`,
      [batchId]
    );

    const stdHasValidSubjects = Array.isArray(stdRows)
      ? stdRows.some((r) => ((r?.lecturecontent ?? r?.lecture_content ?? r?.subject) ?? '').trim())
      : false;

    // If current batch doesn't have standard plan subjects yet, derive from previous batch (same course)
    // that has a standard lecture plan — this mirrors how the dashboard standard plan can be seeded.
    let derivedRows: any[] = [];
    if (!stdHasValidSubjects) {
      const [batchInfo] = await pool.query<any[]>(
        `SELECT Course_Id
         FROM batch_mst
         WHERE Batch_Id = ?
         LIMIT 1`,
        [batchId]
      );

      const courseId = batchInfo?.[0]?.Course_Id;
      if (courseId) {
        const [prevBatchRows] = await pool.query<any[]>(
          `SELECT b.Batch_Id
           FROM batch_mst b
           WHERE b.Course_Id = ?
             AND b.Batch_Id != ?
             AND EXISTS (
               SELECT 1
               FROM batch_slecture_master s
               WHERE s.batch_id = b.Batch_Id AND (s.deleted IS NULL OR s.deleted = '0' OR s.deleted = 0)
             )
           ORDER BY b.SDate DESC, b.Batch_Id DESC
           LIMIT 1`,
          [courseId, batchId]
        );

        const prevBatchId = prevBatchRows?.[0]?.Batch_Id;
        if (prevBatchId) {
          const [prevStdRows] = await pool.query<any[]>(
            `SELECT lecturecontent, subject, subject_topic
             FROM batch_slecture_master
             WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0' OR deleted = 0)
             ORDER BY lecture_no ASC, date ASC, id ASC`,
            [prevBatchId]
          );
          derivedRows = Array.isArray(prevStdRows) ? prevStdRows : [];
        }
      }
    }

    // Last fallback: Lecture Plan (batch_lecture_master)
    let lecRows: any[] = [];
    if (!stdHasValidSubjects && derivedRows.length === 0) {
      const [rows] = await pool.query<any[]>(
        `SELECT lecturecontent, subject, subject_topic
         FROM batch_lecture_master
         WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0' OR deleted = 0)
         ORDER BY lecture_no ASC, date ASC, id ASC`,
        [batchId]
      );
      lecRows = Array.isArray(rows) ? rows : [];
    }

    const source = stdHasValidSubjects ? 'standard' : (derivedRows.length ? 'previous-standard' : 'lecture-plan');
    const rows = (stdHasValidSubjects ? stdRows : (derivedRows.length ? derivedRows : lecRows)) as any[];

    const groups = new Map<string, { display: string; subtopics: string[] }>();

    for (const r of rows) {
      // Dashboard Standard Lecture Plan treats `lecturecontent` as the primary "Subject".
      const discipline = uniqNonEmpty([r?.lecturecontent, r?.lecture_content, r?.subject])[0];
      if (!discipline) continue; // don't synthesize "General"; only return real subjects
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

    // Keep the same order as the Standard Lecture Plan table (lecture_no/date order).
    // `groups` preserves insertion order based on first appearance in the ordered rows.

    return NextResponse.json(
      {
        disciplines,
        meta: {
          batchId,
          source,
          rowCount: rows.length,
          disciplineCount: disciplines.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: unknown) {
    console.error('Lecture topics error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
