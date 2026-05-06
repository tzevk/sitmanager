/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from './db';
import { requirePermission } from './api-auth';
import { apiRateLimiter } from './rate-limit';
import { ensureOnce, jsonOk, jsonErr, badRequest, parseId } from './finance-helpers';

export interface ResourceConfig {
  /** Physical SQL table name. */
  table: string;
  /** CREATE TABLE IF NOT EXISTS DDL — runs once per process via ensureOnce. */
  ddl: string;
  /** Default ORDER BY clause for the list endpoint (without leading "ORDER BY"). */
  defaultOrder: string;
  /** Optional list of supported equality query params → DB columns. */
  filters?: { param: string; column: string }[];
  /** Validate the POST/PUT body. Throw to reject. Returns the (column, value) pairs. */
  validate: (body: any) => { col: string; val: unknown }[];
}

/** Build GET (list) + POST (create) handlers for /api/finance/<resource>. */
export function collectionHandlers(cfg: ResourceConfig) {
  return {
    async GET(req: NextRequest) {
      const limited = apiRateLimiter(req);
      if (limited) return limited;
      const auth = await requirePermission(req, 'finance.view');
      if (auth instanceof NextResponse) return auth;
      try {
        await ensureOnce(getPool(), cfg.table, cfg.ddl);
        const url = new URL(req.url);

        const where: string[] = [];
        const params: unknown[] = [];
        for (const f of cfg.filters ?? []) {
          const v = url.searchParams.get(f.param);
          if (v != null && v !== '') {
            where.push(`\`${f.column}\` = ?`);
            params.push(v);
          }
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const sql = `SELECT * FROM ${cfg.table} ${whereSql} ORDER BY ${cfg.defaultOrder}`;
        const [rows] = await getPool().query<any[]>(sql, params);
        return jsonOk({ rows });
      } catch (err: any) {
        return jsonErr(err?.message ?? 'Server error');
      }
    },

    async POST(req: NextRequest) {
      const limited = apiRateLimiter(req);
      if (limited) return limited;
      const auth = await requirePermission(req, 'finance.create');
      if (auth instanceof NextResponse) return auth;
      try {
        await ensureOnce(getPool(), cfg.table, cfg.ddl);
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

        let pairs: ReturnType<ResourceConfig['validate']>;
        try { pairs = cfg.validate(body); } catch (e: any) { return badRequest(e?.message ?? 'Invalid input'); }

        const cols = pairs.map(p => `\`${p.col}\``).join(', ');
        const placeholders = pairs.map(() => '?').join(', ');
        const vals = pairs.map(p => p.val);

        const [result] = await getPool().query<any>(
          `INSERT INTO ${cfg.table} (${cols}) VALUES (${placeholders})`,
          vals,
        );
        const insertId = (result as { insertId?: number }).insertId;
        const [rows] = await getPool().query<any[]>(`SELECT * FROM ${cfg.table} WHERE id=?`, [insertId]);
        return jsonOk({ row: rows[0] }, { status: 201 });
      } catch (err: any) {
        return jsonErr(err?.message ?? 'Server error');
      }
    },
  };
}

/** Build PUT + DELETE handlers for /api/finance/<resource>/[id]. */
export function idHandlers(cfg: ResourceConfig) {
  return {
    async PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const limited = apiRateLimiter(req);
      if (limited) return limited;
      const auth = await requirePermission(req, 'finance.update');
      if (auth instanceof NextResponse) return auth;
      try {
        await ensureOnce(getPool(), cfg.table, cfg.ddl);
        const { id: rawId } = await params;
        const id = parseId(rawId);
        if (id == null) return badRequest('Invalid id');

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

        let pairs: ReturnType<ResourceConfig['validate']>;
        try { pairs = cfg.validate(body); } catch (e: any) { return badRequest(e?.message ?? 'Invalid input'); }

        const setSql = pairs.map(p => `\`${p.col}\` = ?`).join(', ');
        const vals = [...pairs.map(p => p.val), id];

        await getPool().query(`UPDATE ${cfg.table} SET ${setSql} WHERE id = ?`, vals);
        const [rows] = await getPool().query<any[]>(`SELECT * FROM ${cfg.table} WHERE id=?`, [id]);
        if (!rows.length) return jsonErr('Not found', 404);
        return jsonOk({ row: rows[0] });
      } catch (err: any) {
        return jsonErr(err?.message ?? 'Server error');
      }
    },

    async DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const limited = apiRateLimiter(req);
      if (limited) return limited;
      const auth = await requirePermission(req, 'finance.delete');
      if (auth instanceof NextResponse) return auth;
      try {
        await ensureOnce(getPool(), cfg.table, cfg.ddl);
        const { id: rawId } = await params;
        const id = parseId(rawId);
        if (id == null) return badRequest('Invalid id');

        await getPool().query(`DELETE FROM ${cfg.table} WHERE id = ?`, [id]);
        return jsonOk({ ok: true });
      } catch (err: any) {
        return jsonErr(err?.message ?? 'Server error');
      }
    },
  };
}
