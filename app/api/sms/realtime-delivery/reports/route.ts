import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';

const REPORTS_TABLE = process.env.SMS_DELIVERY_REPORTS_TABLE || 'sms_delivery_reports';
let tableReady = false;

type ReportRow = RowDataPacket & {
  id: number;
  message_id: string | null;
  mobile: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
  error_code: string | null;
  source_ip: string | null;
  created_at: string;
};

function toPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

async function ensureTable() {
  if (tableReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${REPORTS_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      message_id VARCHAR(191) NULL,
      mobile VARCHAR(30) NULL,
      delivery_status VARCHAR(100) NULL,
      delivered_at VARCHAR(100) NULL,
      error_code VARCHAR(100) NULL,
      auth_header VARCHAR(255) NULL,
      source_ip VARCHAR(100) NULL,
      payload_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_message_id (message_id),
      KEY idx_mobile (mobile),
      KEY idx_status (delivery_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['report_sms_email.view', 'inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    await ensureTable();

    const pool = getPool();
    const limit = toPositiveInt(req.nextUrl.searchParams.get('limit'), 50, 500);

    const [rows] = await pool.query<ReportRow[]>(
      `
        SELECT
          id,
          message_id,
          mobile,
          delivery_status,
          delivered_at,
          error_code,
          source_ip,
          created_at
        FROM ${REPORTS_TABLE}
        ORDER BY id DESC
        LIMIT ?
      `,
      [limit]
    );

    return NextResponse.json({
      success: true,
      count: rows.length,
      reports: rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load delivery reports';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
