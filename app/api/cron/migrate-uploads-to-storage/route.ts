/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { destroyAllPools } from '@/lib/db';
import { mkdir, readdir, rename, stat } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorizedCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

/**
 * One-time migration: move files saved under the old fallback location
 * (public/uploads/student_document/{studentId}/...) to UPLOADS_DIR
 * (e.g. /home/storage/{studentId}/...). Runs server-side so no SSH access
 * to the host is required.
 */
async function runMigration(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uploadsDir = process.env.UPLOADS_DIR?.trim();
  if (!uploadsDir) {
    return NextResponse.json({ error: 'UPLOADS_DIR is not set' }, { status: 503 });
  }

  const oldRoot = join(process.cwd(), 'public', 'uploads', 'student_document');

  let studentDirs: string[] = [];
  try {
    const entries = await readdir(oldRoot, { withFileTypes: true });
    studentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return NextResponse.json({
      ok: true,
      message: `Old uploads folder not found at ${oldRoot} — nothing to migrate.`,
      moved: 0,
    });
  }

  let movedFiles = 0;
  let movedDirs = 0;
  const errors: string[] = [];

  for (const studentId of studentDirs) {
    const srcDir = join(oldRoot, studentId);
    const destDir = join(uploadsDir, studentId);

    try {
      const files = await readdir(srcDir);
      if (files.length === 0) continue;

      await mkdir(destDir, { recursive: true });

      for (const file of files) {
        const srcFile = join(srcDir, file);
        const destFile = join(destDir, file);
        const s = await stat(srcFile);
        if (!s.isFile()) continue;

        try {
          await rename(srcFile, destFile);
          movedFiles++;
        } catch (e) {
          errors.push(`${studentId}/${file}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      movedDirs++;
    } catch (e) {
      errors.push(`${studentId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    oldRoot,
    uploadsDir,
    studentFoldersFound: studentDirs.length,
    studentFoldersMoved: movedDirs,
    filesMoved: movedFiles,
    errors: errors.slice(0, 20),
    errorCount: errors.length,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await runMigration(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration failed';
    console.error('migrate-uploads-to-storage GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await destroyAllPools();
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
