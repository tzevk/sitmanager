import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

let tableReady = false;
const REPORTS_TABLE = process.env.SMS_DELIVERY_REPORTS_TABLE || 'sms_delivery_reports';

function getHeader(req: NextRequest, key: string): string {
  return req.headers.get(key) || '';
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
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

async function parsePayload(req: NextRequest): Promise<{ data: Record<string, unknown>; raw: string }> {
  const raw = await req.text();
  const contentType = (req.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      return { data: toRecord(JSON.parse(raw)), raw };
    } catch {
      return { data: {}, raw };
    }
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data') ||
    contentType.includes('text/plain')
  ) {
    const params = new URLSearchParams(raw);
    const data: Record<string, unknown> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });
    return { data, raw };
  }

  // Last fallback: try JSON then URLSearchParams.
  try {
    return { data: toRecord(JSON.parse(raw)), raw };
  } catch {
    const params = new URLSearchParams(raw);
    const data: Record<string, unknown> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });
    return { data, raw };
  }
}

function normalizeDeliveryPayload(payload: Record<string, unknown>) {
  return {
    messageId: pickFirst(payload, ['messageId', 'message_id', 'msgid', 'messageid', 'id']),
    mobile: pickFirst(payload, ['mobile', 'phone', 'msisdn', 'to', 'recipient']),
    deliveryStatus: pickFirst(payload, ['deliveryStatus', 'delivery_status', 'dlr_status', 'status']),
    deliveredAt: pickFirst(payload, ['deliveredAt', 'delivered_at', 'done_date', 'timestamp', 'time']),
    errorCode: pickFirst(payload, ['errorCode', 'error_code', 'err_code', 'reason_code', 'error']),
  };
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SMS_DELIVERY_WEBHOOK_SECRET;
  if (!expected) return true;

  const headerName = (process.env.SMS_DELIVERY_WEBHOOK_HEADER || 'authorization').toLowerCase();
  const actual = getHeader(req, headerName);
  return actual === expected;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'sms-realtime-delivery-webhook' });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    const { data, raw } = await parsePayload(req);
    const normalized = normalizeDeliveryPayload(data);

    await ensureTable();
    const pool = getPool();
    await pool.query(
      `
        INSERT INTO ${REPORTS_TABLE} (
          message_id,
          mobile,
          delivery_status,
          delivered_at,
          error_code,
          auth_header,
          source_ip,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalized.messageId,
        normalized.mobile,
        normalized.deliveryStatus,
        normalized.deliveredAt,
        normalized.errorCode,
        getHeader(req, (process.env.SMS_DELIVERY_WEBHOOK_HEADER || 'authorization').toLowerCase()).slice(0, 255),
        (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').slice(0, 100),
        JSON.stringify({ normalized, parsed: data, raw }),
      ]
    );

    return NextResponse.json({ ok: true, received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process delivery report';
    console.error('SMS realtime delivery webhook error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
