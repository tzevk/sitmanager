/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, timingSafeEqual } from 'crypto';
import { getPool } from '@/lib/db';
import { createInquiry, updateInquiry, type CreateInquiryInput } from '@/lib/services/inquiry.service';
import { sendAdmissionFormEmail } from '@/lib/mailer';

const META_LEADS_TABLE = 'meta_ads_lead_sync';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';
const META_SOURCE_LABEL = 'Meta Ads';
const META_CONTACT_SOURCE = 'Meta Instant Form';

let metaTablesReady = false;

export interface MetaWebhookLeadEvent {
  leadgen_id?: string;
  form_id?: string;
  page_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  adgroup_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  created_time?: string;
  [key: string]: unknown;
}

interface GraphLeadFieldValue {
  name?: string;
  values?: string[];
}

interface MetaLeadDetails {
  id: string;
  created_time?: string;
  field_data?: GraphLeadFieldValue[];
  ad_id?: string;
  form_id?: string;
  is_organic?: boolean;
  campaign_id?: string;
}

interface MetaLeadContext {
  formId: string | null;
  formName: string | null;
  pageId: string | null;
  pageName: string | null;
  adId: string | null;
  adName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

interface DuplicateMatch {
  inquiryId: number;
  studentName: string | null;
  presentMobile: string | null;
  email: string | null;
  courseId: number | null;
}

export interface MetaLeadSyncResult {
  leadId: string;
  inquiryId: number;
  duplicate: boolean;
  created: boolean;
  tags: string[];
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeDigits(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(value: unknown): string | null {
  const email = normalizeText(value)?.toLowerCase() || null;
  return email && email.includes('@') ? email : null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeDateOnly(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function firstValue(values: Record<string, string | null>, keys: string[]): string | null {
  for (const key of keys) {
    const value = values[key];
    if (value) return value;
  }
  return null;
}

function sanitizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

async function ensureMetaLeadTables() {
  if (metaTablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${META_LEADS_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      meta_lead_id VARCHAR(191) NOT NULL,
      inquiry_id INT NULL,
      duplicate_of_inquiry_id INT NULL,
      source_label VARCHAR(100) NOT NULL DEFAULT 'Meta Ads',
      contact_source VARCHAR(100) NOT NULL DEFAULT 'Meta Instant Form',
      page_id VARCHAR(191) NULL,
      page_name VARCHAR(255) NULL,
      form_id VARCHAR(191) NULL,
      form_name VARCHAR(255) NULL,
      campaign_id VARCHAR(191) NULL,
      campaign_name VARCHAR(255) NULL,
      adset_id VARCHAR(191) NULL,
      adset_name VARCHAR(255) NULL,
      ad_id VARCHAR(191) NULL,
      ad_name VARCHAR(255) NULL,
      lead_created_time VARCHAR(100) NULL,
      student_name VARCHAR(255) NULL,
      mobile VARCHAR(30) NULL,
      email VARCHAR(191) NULL,
      course_name VARCHAR(255) NULL,
      utm_json LONGTEXT NULL,
      tags_json LONGTEXT NULL,
      fields_json LONGTEXT NULL,
      payload_json LONGTEXT NULL,
      duplicate_reason VARCHAR(255) NULL,
      last_error TEXT NULL,
      notifications_sent_at TIMESTAMP NULL,
      synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_meta_ads_lead_id (meta_lead_id),
      KEY idx_meta_ads_inquiry_id (inquiry_id),
      KEY idx_meta_ads_duplicate_inquiry_id (duplicate_of_inquiry_id),
      KEY idx_meta_ads_campaign_id (campaign_id),
      KEY idx_meta_ads_form_id (form_id),
      KEY idx_meta_ads_mobile (mobile),
      KEY idx_meta_ads_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  metaTablesReady = true;
}

function getMetaAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('META_ACCESS_TOKEN is not configured');
  }
  return token;
}

function buildGraphUrl(path: string, fields?: string[]): URL {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${cleanPath}`);
  url.searchParams.set('access_token', getMetaAccessToken());
  if (fields?.length) {
    url.searchParams.set('fields', fields.join(','));
  }
  return url;
}

async function fetchGraphJson<T>(path: string, fields?: string[]): Promise<T> {
  const res = await fetch(buildGraphUrl(path, fields).toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error?.message || `Meta Graph API failed with ${res.status}`);
  }
  return data as T;
}

async function fetchLeadDetails(leadId: string): Promise<MetaLeadDetails> {
  return fetchGraphJson<MetaLeadDetails>(`/${leadId}`, [
    'id',
    'created_time',
    'field_data',
    'ad_id',
    'form_id',
    'campaign_id',
    'is_organic',
  ]);
}

async function fetchLeadContext(event: MetaWebhookLeadEvent, lead: MetaLeadDetails): Promise<MetaLeadContext> {
  const formId = normalizeText(event.form_id) || normalizeText(lead.form_id);
  const pageId = normalizeText(event.page_id);
  const adId = normalizeText(event.ad_id) || normalizeText(lead.ad_id);

  let formName: string | null = null;
  let pageName: string | null = null;
  let adName: string | null = null;
  let adsetId: string | null = normalizeText(event.adgroup_id);
  let adsetName: string | null = normalizeText(event.adgroup_name);
  let campaignId: string | null = normalizeText(event.campaign_id) || normalizeText(lead.campaign_id);
  let campaignName: string | null = normalizeText(event.campaign_name);

  const tasks: Promise<void>[] = [];

  if (formId) {
    tasks.push((async () => {
      try {
        const form = await fetchGraphJson<{ name?: string }>(`/${formId}`, ['name']);
        formName = normalizeText(form.name);
      } catch {
        formName = null;
      }
    })());
  }

  if (pageId) {
    tasks.push((async () => {
      try {
        const page = await fetchGraphJson<{ name?: string }>(`/${pageId}`, ['name']);
        pageName = normalizeText(page.name);
      } catch {
        pageName = null;
      }
    })());
  }

  if (adId) {
    tasks.push((async () => {
      try {
        const ad = await fetchGraphJson<any>(`/${adId}`, ['name', 'adset{id,name,campaign{id,name}}']);
        adName = normalizeText(ad?.name);
        adsetId = adsetId || normalizeText(ad?.adset?.id);
        adsetName = adsetName || normalizeText(ad?.adset?.name);
        campaignId = campaignId || normalizeText(ad?.adset?.campaign?.id);
        campaignName = campaignName || normalizeText(ad?.adset?.campaign?.name);
      } catch {
        // keep webhook values if available
      }
    })());
  }

  await Promise.all(tasks);

  return {
    formId,
    formName,
    pageId,
    pageName,
    adId,
    adName,
    adsetId,
    adsetName,
    campaignId,
    campaignName,
  };
}

function mapLeadFields(fields: GraphLeadFieldValue[] | undefined): Record<string, string | null> {
  const mapped: Record<string, string | null> = {};
  for (const field of fields || []) {
    const key = String(field?.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!key) continue;
    const value = Array.isArray(field?.values)
      ? field.values.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ')
      : null;
    mapped[key] = value || null;
  }
  return mapped;
}

async function resolveCourseId(courseName: string | null): Promise<number | null> {
  if (!courseName) return null;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT Course_Id
     FROM course_mst
     WHERE LOWER(TRIM(Course_Name)) = LOWER(TRIM(?))
        OR LOWER(TRIM(Course_Name)) LIKE LOWER(TRIM(?))
     LIMIT 1`,
    [courseName, `%${courseName}%`]
  );
  const id = Number((rows as any[])[0]?.Course_Id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function findDuplicateInquiry(mobile: string | null, email: string | null): Promise<DuplicateMatch | null> {
  if (!mobile && !email) return null;

  const conditions: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const params: any[] = [];

  if (mobile) {
    conditions.push(`RIGHT(REGEXP_REPLACE(COALESCE(si.Present_Mobile,''), '[^0-9]', ''), 10) = ?`);
    params.push(mobile);
  }
  if (email) {
    conditions.push(`LOWER(TRIM(COALESCE(si.Email,''))) = ?`);
    params.push(email);
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
       si.Inquiry_Id as inquiryId,
       si.Student_Name as studentName,
       si.Present_Mobile as presentMobile,
       si.Email as email,
       CAST(NULLIF(si.Course_Id,'') AS UNSIGNED) as courseId
     FROM Student_Inquiry si
     WHERE ${conditions.join(' OR ')}
     ORDER BY si.Inquiry_Id DESC
     LIMIT 1`,
    params
  );

  const row = (rows as any[])[0];
  if (!row) return null;
  return {
    inquiryId: Number(row.inquiryId),
    studentName: normalizeText(row.studentName),
    presentMobile: normalizeText(row.presentMobile),
    email: normalizeText(row.email),
    courseId: parseNumber(row.courseId),
  };
}

async function addDiscussionNote(inquiryId: number, discussion: string) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
     VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
    [inquiryId, discussion]
  );
}

function buildDiscussionNote(ctx: MetaLeadContext, tags: string[]): string {
  const parts = [
    'Meta lead synced',
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : ctx.campaignId ? `Campaign ID: ${ctx.campaignId}` : null,
    ctx.adName ? `Ad: ${ctx.adName}` : ctx.adId ? `Ad ID: ${ctx.adId}` : null,
    ctx.formName ? `Form: ${ctx.formName}` : ctx.formId ? `Form ID: ${ctx.formId}` : null,
    tags.length ? `Tags: ${tags.join(', ')}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function buildTags(fields: Record<string, string | null>, ctx: MetaLeadContext): string[] {
  const tags = new Set<string>(['meta', 'instant-lead']);
  if (ctx.campaignName) tags.add(`campaign:${sanitizeLabel(ctx.campaignName)}`);
  if (ctx.formName) tags.add(`form:${sanitizeLabel(ctx.formName)}`);
  if (ctx.pageName) tags.add(`page:${sanitizeLabel(ctx.pageName)}`);

  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    if (key.startsWith('utm_')) tags.add(`${key}:${sanitizeLabel(value)}`);
    if (['city', 'location', 'state'].includes(key)) tags.add(`${key}:${sanitizeLabel(value)}`);
    if (['course', 'course_name', 'training_programme', 'interested_course'].includes(key)) {
      tags.add(`course:${sanitizeLabel(value)}`);
    }
  }

  return Array.from(tags).sort();
}

async function notifyRecipients(input: {
  inquiryId: number;
  studentName: string;
  mobile: string | null;
  email: string | null;
  tags: string[];
  ctx: MetaLeadContext;
  duplicate: boolean;
}) {
  const recipients = String(process.env.META_LEAD_NOTIFY_EMAILS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;

  const subject = input.duplicate
    ? `Duplicate Meta lead matched inquiry #${input.inquiryId}`
    : `New Meta lead synced to inquiry #${input.inquiryId}`;
  const lines = [
    `Student: ${input.studentName}`,
    input.mobile ? `Mobile: ${input.mobile}` : null,
    input.email ? `Email: ${input.email}` : null,
    input.ctx.campaignName ? `Campaign: ${input.ctx.campaignName}` : null,
    input.ctx.formName ? `Form: ${input.ctx.formName}` : null,
    input.tags.length ? `Tags: ${input.tags.join(', ')}` : null,
    '',
    `Inquiry ID: ${input.inquiryId}`,
  ].filter(Boolean).join('\n');

  await Promise.all(
    recipients.map((toEmail) =>
      sendAdmissionFormEmail({
        toEmail,
        studentName: input.studentName,
        admissionFormUrl: '#',
        subject,
        text: lines,
        html: lines.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join(''),
      })
    )
  );
}

async function upsertMetaLeadRow(params: {
  leadId: string;
  inquiryId: number;
  duplicateOfInquiryId: number | null;
  sourceLabel: string;
  contactSource: string;
  studentName: string | null;
  mobile: string | null;
  email: string | null;
  courseName: string | null;
  leadCreatedTime: string | null;
  ctx: MetaLeadContext;
  tags: string[];
  utm: Record<string, string | null>;
  fields: Record<string, string | null>;
  payload: unknown;
  duplicateReason: string | null;
  errorMessage?: string | null;
  markNotified?: boolean;
}) {
  await ensureMetaLeadTables();
  const pool = getPool();
  await pool.query(
    `INSERT INTO ${META_LEADS_TABLE} (
       meta_lead_id, inquiry_id, duplicate_of_inquiry_id,
       source_label, contact_source,
       page_id, page_name, form_id, form_name,
       campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
       lead_created_time, student_name, mobile, email, course_name,
       utm_json, tags_json, fields_json, payload_json,
       duplicate_reason, last_error, notifications_sent_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       inquiry_id = VALUES(inquiry_id),
       duplicate_of_inquiry_id = VALUES(duplicate_of_inquiry_id),
       source_label = VALUES(source_label),
       contact_source = VALUES(contact_source),
       page_id = VALUES(page_id),
       page_name = VALUES(page_name),
       form_id = VALUES(form_id),
       form_name = VALUES(form_name),
       campaign_id = VALUES(campaign_id),
       campaign_name = VALUES(campaign_name),
       adset_id = VALUES(adset_id),
       adset_name = VALUES(adset_name),
       ad_id = VALUES(ad_id),
       ad_name = VALUES(ad_name),
       lead_created_time = VALUES(lead_created_time),
       student_name = VALUES(student_name),
       mobile = VALUES(mobile),
       email = VALUES(email),
       course_name = VALUES(course_name),
       utm_json = VALUES(utm_json),
       tags_json = VALUES(tags_json),
       fields_json = VALUES(fields_json),
       payload_json = VALUES(payload_json),
       duplicate_reason = VALUES(duplicate_reason),
       last_error = VALUES(last_error),
       notifications_sent_at = VALUES(notifications_sent_at)`,
    [
      params.leadId,
      params.inquiryId,
      params.duplicateOfInquiryId,
      params.sourceLabel,
      params.contactSource,
      params.ctx.pageId,
      params.ctx.pageName,
      params.ctx.formId,
      params.ctx.formName,
      params.ctx.campaignId,
      params.ctx.campaignName,
      params.ctx.adsetId,
      params.ctx.adsetName,
      params.ctx.adId,
      params.ctx.adName,
      params.leadCreatedTime,
      params.studentName,
      params.mobile,
      params.email,
      params.courseName,
      JSON.stringify(params.utm),
      JSON.stringify(params.tags),
      JSON.stringify(params.fields),
      JSON.stringify(params.payload),
      params.duplicateReason,
      params.errorMessage ?? null,
      params.markNotified ? new Date() : null,
    ]
  );
}

export async function syncMetaLead(event: MetaWebhookLeadEvent, rawPayload: unknown): Promise<MetaLeadSyncResult> {
  const leadId = normalizeText(event.leadgen_id);
  if (!leadId) throw new Error('leadgen_id is required');

  const lead = await fetchLeadDetails(leadId);
  const ctx = await fetchLeadContext(event, lead);
  const fields = mapLeadFields(lead.field_data);

  const studentName = firstValue(fields, ['full_name', 'full_name_1', 'name'])
    || [firstValue(fields, ['first_name']), firstValue(fields, ['last_name'])].filter(Boolean).join(' ').trim()
    || 'Meta Lead';
  const email = normalizeEmail(firstValue(fields, ['email', 'email_address']));
  const mobile = normalizeDigits(firstValue(fields, ['phone_number', 'phone', 'mobile', 'whatsapp_number', 'whatsapp']));
  const courseName = firstValue(fields, ['course', 'course_name', 'interested_course', 'training_programme', 'training_program']);
  const qualification = firstValue(fields, ['qualification', 'highest_qualification']);
  const discipline = firstValue(fields, ['discipline', 'stream']);
  const percentage = parseNumber(firstValue(fields, ['percentage', 'marks_percentage']));
  const inquiryDate = normalizeDateOnly(lead.created_time || event.created_time) || new Date().toISOString().slice(0, 10);
  const courseId = await resolveCourseId(courseName);
  const tags = buildTags(fields, ctx);
  const utm = Object.fromEntries(Object.entries(fields).filter(([key]) => key.startsWith('utm_')));
  const discussion = buildDiscussionNote(ctx, tags);

  const duplicate = await findDuplicateInquiry(mobile, email);

  let inquiryId: number;
  let created = false;
  let duplicateReason: string | null = null;

  if (duplicate) {
    inquiryId = duplicate.inquiryId;
    duplicateReason = mobile && email
      ? 'Matched existing inquiry by mobile or email'
      : mobile
        ? 'Matched existing inquiry by mobile'
        : 'Matched existing inquiry by email';

    await updateInquiry(inquiryId, {
      Student_Name: duplicate.studentName || studentName,
      Present_Mobile: duplicate.presentMobile || mobile,
      Email: duplicate.email || email,
      Inquiry_From: META_CONTACT_SOURCE,
      Inquiry_Type: META_SOURCE_LABEL,
      Course_Id: duplicate.courseId || courseId,
      Discussion: discussion,
    });
  } else {
    const createPayload: CreateInquiryInput = {
      Student_Name: studentName,
      Present_Mobile: mobile,
      Email: email,
      Inquiry_Dt: inquiryDate,
      Inquiry_From: META_CONTACT_SOURCE,
      Inquiry_Type: META_SOURCE_LABEL,
      Course_Id: courseId,
      Qualification: qualification,
      Discipline: discipline,
      Percentage: percentage != null ? String(percentage) : null,
      Discussion: discussion,
      Status_id: 1,
    };
    inquiryId = await createInquiry(createPayload);
    created = true;
  }

  if (discussion) {
    await addDiscussionNote(inquiryId, discussion);
  }

  let notified = false;
  try {
    await notifyRecipients({
      inquiryId,
      studentName,
      mobile,
      email,
      tags,
      ctx,
      duplicate: Boolean(duplicate),
    });
    notified = true;
  } catch (error) {
    console.error('Meta lead notification error:', error);
  }

  await upsertMetaLeadRow({
    leadId,
    inquiryId,
    duplicateOfInquiryId: duplicate?.inquiryId ?? null,
    sourceLabel: META_SOURCE_LABEL,
    contactSource: META_CONTACT_SOURCE,
    studentName,
    mobile,
    email,
    courseName,
    leadCreatedTime: normalizeText(lead.created_time || event.created_time),
    ctx,
    tags,
    utm,
    fields,
    payload: { event, lead },
    duplicateReason,
    markNotified: notified,
  });

  return {
    leadId,
    inquiryId,
    duplicate: Boolean(duplicate),
    created,
    tags,
  };
}

export function verifyMetaWebhookChallenge(searchParams: URLSearchParams): { ok: boolean; status: number; body: string } {
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge') || '';
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode !== 'subscribe') {
    return { ok: false, status: 400, body: 'Unsupported mode' };
  }
  if (!expected) {
    return { ok: false, status: 500, body: 'META_WEBHOOK_VERIFY_TOKEN is not configured' };
  }
  if (token !== expected) {
    return { ok: false, status: 403, body: 'Invalid verify token' };
  }
  return { ok: true, status: 200, body: challenge };
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = Buffer.from(signatureHeader.slice(7), 'hex');
  const actual = createHmac('sha256', appSecret).update(rawBody).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function fetchMetaCampaignPerformance(params: { dateFrom?: string | null; dateTo?: string | null }) {
  const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error('META_AD_ACCOUNT_ID is not configured');
  }

  const url = buildGraphUrl(`/act_${accountId}/insights`, [
    'campaign_id',
    'campaign_name',
    'reach',
    'impressions',
    'clicks',
    'ctr',
    'spend',
    'cpc',
    'actions',
    'cost_per_action_type',
  ]);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('limit', '100');

  if (params.dateFrom && params.dateTo) {
    url.searchParams.set('time_range', JSON.stringify({ since: params.dateFrom, until: params.dateTo }));
  }

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error?.message || `Meta insights request failed with ${res.status}`);
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map((row: any) => {
    const actions = Array.isArray(row?.actions) ? row.actions : [];
    const leads = actions
      .filter((item: any) => ['lead', 'onsite_conversion.lead_grouped', 'leadgen.other'].includes(String(item?.action_type || '')))
      .reduce((sum: number, item: any) => sum + Number(item?.value || 0), 0);

    return {
      campaignId: normalizeText(row?.campaign_id),
      campaignName: normalizeText(row?.campaign_name),
      reach: Number(row?.reach || 0),
      impressions: Number(row?.impressions || 0),
      clicks: Number(row?.clicks || 0),
      ctr: Number(row?.ctr || 0),
      spend: Number(row?.spend || 0),
      cpc: Number(row?.cpc || 0),
      leads,
      costPerLead: leads > 0 ? Number(row?.spend || 0) / leads : null,
    };
  });
}
