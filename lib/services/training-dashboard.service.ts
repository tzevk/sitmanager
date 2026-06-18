import type { Pool } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export type TrainingDashboardWidgetType = 'upcoming_exam' | 'finished_exam' | 'google_review';

export interface TrainingDashboardMetaRow {
  widget_type: TrainingDashboardWidgetType;
  entity_key: string;
  status: string | null;
  numeric_value: number | null;
  date_value: string | null;
  notes: string | null;
}

export const UPCOMING_EXAM_STATUS_OPTIONS = ['Not Started', 'Being Prepared', 'Prepared', 'Approved'] as const;
export const FINISHED_EXAM_STATUS_OPTIONS = ['Pending', 'Checked', 'Shown'] as const;

let ensureTrainingDashboardMetaPromise: Promise<void> | null = null;

export async function ensureTrainingDashboardMetaTable(pool: Pool = getPool()): Promise<void> {
  if (!ensureTrainingDashboardMetaPromise) {
    ensureTrainingDashboardMetaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS training_dashboard_meta (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        widget_type VARCHAR(40) NOT NULL,
        entity_key VARCHAR(160) NOT NULL,
        status VARCHAR(40) NULL,
        numeric_value INT NULL,
        date_value DATE NULL,
        notes VARCHAR(255) NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_training_dashboard_meta_widget_entity (widget_type, entity_key),
        KEY idx_training_dashboard_meta_widget (widget_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      ensureTrainingDashboardMetaPromise = null;
      throw error;
    });
  }

  await ensureTrainingDashboardMetaPromise;
}

export function getTrainingDashboardEntityKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => String(part ?? '').trim()).join('|').slice(0, 160);
}

export function validateTrainingDashboardStatus(widgetType: TrainingDashboardWidgetType, status: string | null): string | null {
  const trimmed = status?.trim() || null;
  if (!trimmed) return null;

  const allowed = widgetType === 'upcoming_exam'
    ? UPCOMING_EXAM_STATUS_OPTIONS
    : widgetType === 'finished_exam'
      ? FINISHED_EXAM_STATUS_OPTIONS
      : [];

  if (allowed.length === 0) return trimmed;
  return (allowed as readonly string[]).includes(trimmed) ? trimmed : null;
}

export async function getTrainingDashboardMetaRows(pool: Pool = getPool()): Promise<TrainingDashboardMetaRow[]> {
  await ensureTrainingDashboardMetaTable(pool);
  const [rows] = await pool.query(`
    SELECT widget_type, entity_key, status, numeric_value, DATE_FORMAT(date_value, '%Y-%m-%d') AS date_value, notes
    FROM training_dashboard_meta
  `);
  return rows as TrainingDashboardMetaRow[];
}

export async function upsertTrainingDashboardMeta(params: {
  widgetType: TrainingDashboardWidgetType;
  entityKey: string;
  status?: string | null;
  numericValue?: number | null;
  dateValue?: string | null;
  notes?: string | null;
  updatedBy?: number | null;
}, pool: Pool = getPool()): Promise<void> {
  await ensureTrainingDashboardMetaTable(pool);

  const status = validateTrainingDashboardStatus(params.widgetType, params.status ?? null);
  if ((params.status?.trim() || null) && status === null) {
    throw new Error('Invalid status');
  }

  const entityKey = params.entityKey.trim().slice(0, 160);
  if (!entityKey) throw new Error('Entity key is required');

  const numericValue = params.numericValue == null ? null : Math.max(0, Math.floor(Number(params.numericValue) || 0));
  const dateValue = params.dateValue?.trim() || null;
  const notes = params.notes?.trim().slice(0, 255) || null;

  await pool.query(
    `INSERT INTO training_dashboard_meta (widget_type, entity_key, status, numeric_value, date_value, notes, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       numeric_value = VALUES(numeric_value),
       date_value = VALUES(date_value),
       notes = VALUES(notes),
       updated_by = VALUES(updated_by)`,
    [params.widgetType, entityKey, status, numericValue, dateValue, notes, params.updatedBy ?? null],
  );
}
