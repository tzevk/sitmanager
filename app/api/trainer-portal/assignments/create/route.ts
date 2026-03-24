/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type mysql from 'mysql2/promise';

export const runtime = 'nodejs';

function safeFilename(name: string) {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80);
}

async function ensureTables(conn: any) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS trainer_assignment_master (
      Assignment_Id INT NOT NULL AUTO_INCREMENT,
      Faculty_Id INT NOT NULL,
      Batch_Id INT NOT NULL,
      Take_Id INT NULL,
      Assignment_Name VARCHAR(255) NOT NULL,
      Assignment_Date DATE NOT NULL,
      Due_Date DATE NOT NULL,
      Topic VARCHAR(255) NULL,
      Sub_Topics TEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (Assignment_Id),
      INDEX idx_faculty_batch (Faculty_Id, Batch_Id),
      INDEX idx_take (Take_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS trainer_assignment_question (
      Question_Id INT NOT NULL AUTO_INCREMENT,
      Assignment_Id INT NOT NULL,
      Question_Text TEXT NOT NULL,
      Attachment_Url VARCHAR(512) NULL,
      Attachment_Name VARCHAR(255) NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (Question_Id),
      INDEX idx_assignment (Assignment_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function POST(req: NextRequest) {
  let conn: mysql.PoolConnection | undefined;
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();

    const batchId = Number(form.get('batch_id') || 0);
    const takeId = Number(form.get('take_id') || 0);
    const assignmentName = String(form.get('assignment_name') || '').trim();
    const assignmentDate = String(form.get('assignment_date') || '').trim();
    const dueDate = String(form.get('due_date') || '').trim();
    const topic = String(form.get('topic') || '').trim();

    const subTopicsRaw = String(form.get('subtopics') || '[]');
    const questionsRaw = String(form.get('questions') || '[]');

    if (!batchId || !takeId || !assignmentName || !assignmentDate || !dueDate || !topic) {
      return NextResponse.json(
        { error: 'batch_id, take_id, assignment_name, assignment_date, due_date, and topic are required' },
        { status: 400 }
      );
    }

    let subTopics: string[] = [];
    let questions: Array<{ text: string }> = [];

    try {
      const parsed = JSON.parse(subTopicsRaw);
      if (Array.isArray(parsed)) subTopics = parsed.map(String).filter(Boolean);
    } catch {
      subTopics = [];
    }

    try {
      const parsed = JSON.parse(questionsRaw);
      if (Array.isArray(parsed)) {
        questions = parsed.map((q: any) => ({ text: String(q?.text || '').trim() }));
      }
    } catch {
      questions = [];
    }

    const pool = getPool();
    conn = await pool.getConnection();

    // Ensure lecture belongs to trainer
    const facultyId = session.facultyId;
    const [check] = await conn.query<any[]>(
      `SELECT Take_Id FROM lecture_taken_master WHERE Take_Id = ? AND Faculty_Id = ? AND Batch_Id = ?`,
      [takeId, facultyId, batchId]
    );
    if (!check?.length) {
      return NextResponse.json({ error: 'Not authorized for this lecture' }, { status: 403 });
    }

    await conn.beginTransaction();
    await ensureTables(conn);

    const [ins] = await conn.query<any>(
      `INSERT INTO trainer_assignment_master
        (Faculty_Id, Batch_Id, Take_Id, Assignment_Name, Assignment_Date, Due_Date, Topic, Sub_Topics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        facultyId,
        batchId,
        takeId,
        assignmentName,
        assignmentDate,
        dueDate,
        topic,
        subTopics.length ? JSON.stringify(subTopics) : null,
      ]
    );

    const assignmentId = ins?.insertId as number;
    if (!assignmentId) throw new Error('Failed to create assignment');

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'trainer-assignments');
    await mkdir(uploadDir, { recursive: true });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const file = form.get(`attachment_${i}`) as File | null;

      const hasText = !!q.text;
      const hasFile = !!(file && file.size > 0);
      if (!hasText && !hasFile) continue;
      if (hasFile && !hasText) {
        throw new Error(`Question ${i + 1} text is required when adding an attachment`);
      }

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (hasFile) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`Attachment too large for question ${i + 1} (max 10 MB)`);
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const base = safeFilename(file.name.replace(/\.[^/.]+$/, '')) || 'file';
        const filename = `A${assignmentId}_Q${i + 1}_${Date.now()}_${base}.${safeFilename(ext)}`;

        const bytes = await file.arrayBuffer();
        await writeFile(join(uploadDir, filename), Buffer.from(bytes));

        attachmentUrl = `/uploads/trainer-assignments/${filename}`;
        attachmentName = file.name;
      }

      await conn.query(
        `INSERT INTO trainer_assignment_question
          (Assignment_Id, Question_Text, Attachment_Url, Attachment_Name)
         VALUES (?, ?, ?, ?)`,
        [assignmentId, q.text, attachmentUrl, attachmentName]
      );
    }

    // Mark lecture as assignment given (best-effort)
    try {
      await conn.query(
        `UPDATE lecture_taken_master SET Assign_Given = 1 WHERE Take_Id = ?`,
        [takeId]
      );
    } catch {
      // ignore
    }

    await conn.commit();
    return NextResponse.json({ success: true, assignment_id: assignmentId });
  } catch (err: unknown) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    console.error('Assignments create error:', err);
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (conn) {
      try { conn.release(); } catch { /* ignore */ }
    }
  }
}
