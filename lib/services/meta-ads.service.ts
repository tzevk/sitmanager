/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { getPool } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { createInquiry, updateInquiry, type CreateInquiryInput } from '@/lib/services/inquiry.service';
import { sendAdmissionFormEmail } from '@/lib/mailer';

const META_LEADS_TABLE = 'meta_ads_lead_sync';
const META_SETTINGS_TABLE = 'meta_ads_settings';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';
const META_SOURCE_LABEL = 'Meta Ads';
const META_CONTACT_SOURCE = 'Meta Instant Form';
const META_OAUTH_SCOPES = [
  'ads_read',
  'business_management',
  'leads_retrieval',
  'pages_read_engagement',
  'pages_show_list',
];

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

export interface StatusOption {
  id: number;
  label: string;
}

const FALLBACK_STATUSES: Record<number, string> = {
  0: 'New Inquiry', 1: 'Follow Up', 2: 'Interested', 3: 'Confirmed',
  4: 'Not Interested', 5: 'Batch Started', 6: 'Batch Completed',
  7: 'Cancelled', 8: 'Admitted', 9: 'Left', 10: 'On Hold',
  12: 'Prospective', 13: 'Walk In', 15: 'Re-inquiry', 16: 'Demo Attended',
  17: 'Demo Scheduled', 19: 'Online Inquiry', 23: 'Document Pending',
  24: 'Fees Pending', 25: 'Transfer', 26: 'Need Based Training',
  27: 'Duplicate', 29: 'Corporate', 34: 'Assessment Done',
  35: 'Refund', 40: 'Counselling Done',
};

export interface MetaLeadListParams {
  page: number;
  limit: number;
  search?: string;
  leadTag?: string;
  source?: string;
  statusId?: string;
  dateFrom?: string;
  dateTo?: string;
  training?: string;
  duplicatesOnly?: boolean;
}

export interface MetaLeadListRow {
  MetaLead_Id: string;
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Discussion: string | null;
  MetaCampaignName: string | null;
  MetaFormName: string | null;
  LeadTags: string[];
  IsDuplicateLead: boolean;
}

export interface MetaLeadListResult {
  rows: MetaLeadListRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    trainings: string[];
    sources: string[];
    statusOptions: StatusOption[];
  };
}

export interface MetaLeadDetailResult {
  MetaLead_Id: string;
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Discussion: string | null;
  MetaCampaignName: string | null;
  MetaCampaignId: string | null;
  MetaFormName: string | null;
  MetaFormId: string | null;
  MetaPageName: string | null;
  MetaPageId: string | null;
  MetaAdName: string | null;
  MetaAdId: string | null;
  MetaAdsetName: string | null;
  MetaAdsetId: string | null;
  LeadTags: string[];
  IsDuplicateLead: boolean;
  DuplicateOfInquiryId: number | null;
  LastError: string | null;
  NotificationsSentAt: string | null;
  SyncedAt: string | null;
  CreatedAt: string | null;
  UTM: Record<string, string | null>;
  Fields: Record<string, string | null>;
  Payload: unknown;
}

export interface MetaLeadUpdateInput {
  studentName?: string | null;
  courseName?: string | null;
  mobile?: string | null;
  email?: string | null;
  fields?: Record<string, string | null>;
  utm?: Record<string, string | null>;
  statusId?: number | null;
}

export interface MetaLeadSyncOptions {
  sinceHours?: number | null;
  maxPagesPerForm?: number;
}

export interface MetaLeadSyncSummary {
  pages: number;
  forms: number;
  leadsProcessed: number;
  errors: number;
  sinceHours: number | null;
}

interface MetaLeadSourceInfo {
  sourceLabel: string;
  contactSource: string;
  sourceTag: string;
}

interface MetaStoredTokenConfig {
  accessToken: string;
  tokenType: string;
  expiresAt: string | null;
  userId: string | null;
  userName: string | null;
  grantedScopes: string[];
  pages: Array<{ id: string; name: string | null; tasks: string[] }>;
  updatedAt: string;
}

interface MetaOAuthStatePayload {
  ts: number;
  redirectTo: string;
}

interface MetaOAuthExchangeResult {
  accessToken: string;
  expiresAt: string | null;
  userId: string | null;
  userName: string | null;
  grantedScopes: string[];
  pages: Array<{ id: string; name: string | null; tasks: string[] }>;
}

interface MetaConversionsEventInput {
  event_name: string;
  event_time?: number;
  action_source?: string;
  event_id?: string;
  event_source_url?: string;
  user_data?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
}

interface MetaConversionsApiResponse {
  events_received?: number;
  fbtrace_id?: string;
  messages?: string[];
}

interface MetaGraphConnection<T> {
  data?: T[];
  paging?: { next?: string };
}

interface MetaPageRecord {
  id?: string;
  name?: string;
}

interface MetaLeadFormRecord {
  id?: string;
  name?: string;
}

let inquiryTableNameCache: string | null = null;

interface MetaGraphErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
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

async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
  if (inquiryTableNameCache) return inquiryTableNameCache;

  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'student_inquiry'
       ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    inquiryTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
  } catch {
    inquiryTableNameCache = 'Student_Inquiry';
  }

  return inquiryTableNameCache;
}

function normalizeMetaGraphError(payload: unknown, fallback: string): string {
  const error = (payload as MetaGraphErrorPayload | null)?.error;
  const message = normalizeText(error?.message) || fallback;
  const lowered = message.toLowerCase();

  if (lowered.includes('api access deactivated')) {
    return 'Meta API access is deactivated for this app. Reactivate it in the Meta app dashboard, then retry the OAuth connection.';
  }

  return message;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getMetaConversionsAccessToken(): string | null {
  const token = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim() || null;
  return token || null;
}

function getMetaPixelId(): string | null {
  const pixelId = process.env.META_PIXEL_ID?.trim() || '';
  return pixelId || null;
}

function normalizeMetaAdAccountId(value: string): string {
  return value.trim().replace(/^act_/i, '');
}

function extractWebhookSourceLabel(rawPayload: unknown): string | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const objectName = normalizeText((rawPayload as { object?: unknown }).object);
  return objectName ? sanitizeLabel(objectName) : null;
}

function buildMetaEventUserData(params: {
  email: string | null;
  mobile: string | null;
  inquiryId: number;
  leadId: string;
}): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    external_id: [String(params.inquiryId), params.leadId].map(sha256Hex),
  };

  if (params.email) userData.em = [sha256Hex(params.email.trim().toLowerCase())];
  if (params.mobile) userData.ph = [sha256Hex(params.mobile)];

  return userData;
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${META_SETTINGS_TABLE} (
      setting_key VARCHAR(100) NOT NULL,
      setting_value LONGTEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  metaTablesReady = true;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getMetaAppId(): string {
  const appId = process.env.META_APP_ID?.trim() || process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  if (!appId) {
    throw new Error('META_APP_ID or NEXT_PUBLIC_META_APP_ID is not configured');
  }
  return appId;
}

function getMetaAppSecretRequired(): string {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    throw new Error('META_APP_SECRET is not configured');
  }
  return appSecret;
}

async function getMetaSetting(settingKey: string): Promise<string | null> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT setting_value FROM ${META_SETTINGS_TABLE} WHERE setting_key = ? LIMIT 1`,
    [settingKey]
  );
  const value = String((rows as any[])[0]?.setting_value ?? '').trim();
  return value || null;
}

async function setMetaSetting(settingKey: string, value: string): Promise<void> {
  await ensureMetaLeadTables();
  const pool = getPool();
  await pool.query(
    `INSERT INTO ${META_SETTINGS_TABLE} (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [settingKey, value]
  );
}

async function getStoredMetaTokenConfig(): Promise<MetaStoredTokenConfig | null> {
  const raw = await getMetaSetting('oauth_token_config');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MetaStoredTokenConfig>;
    if (!parsed?.accessToken) return null;
    return {
      accessToken: String(parsed.accessToken),
      tokenType: String(parsed.tokenType || 'oauth-user'),
      expiresAt: normalizeText(parsed.expiresAt),
      userId: normalizeText(parsed.userId),
      userName: normalizeText(parsed.userName),
      grantedScopes: Array.isArray(parsed.grantedScopes) ? parsed.grantedScopes.map((item) => String(item)) : [],
      pages: Array.isArray(parsed.pages)
        ? parsed.pages.map((page) => ({
            id: String((page as { id?: unknown }).id || ''),
            name: normalizeText((page as { name?: unknown }).name),
            tasks: Array.isArray((page as { tasks?: unknown }).tasks)
              ? ((page as { tasks?: unknown[] }).tasks || []).map((task) => String(task))
              : [],
          })).filter((page) => page.id)
        : [],
      updatedAt: normalizeText(parsed.updatedAt) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function saveMetaTokenConfig(config: MetaStoredTokenConfig): Promise<void> {
  await setMetaSetting('oauth_token_config', JSON.stringify(config));
}

async function getMetaAccessToken(): Promise<string> {
  const stored = await getStoredMetaTokenConfig();
  if (stored?.accessToken) {
    return stored.accessToken;
  }

  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('META access token is not configured. Set META_ACCESS_TOKEN or connect Meta OAuth.');
  }
  return token;
}

async function buildGraphUrl(path: string, fields?: string[]): Promise<URL> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${cleanPath}`);
  url.searchParams.set('access_token', await getMetaAccessToken());
  if (fields?.length) {
    url.searchParams.set('fields', fields.join(','));
  }
  return url;
}

async function fetchGraphJson<T>(path: string, fields?: string[]): Promise<T> {
  const graphUrl = await buildGraphUrl(path, fields);
  const res = await fetch(graphUrl.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(normalizeMetaGraphError(data, `Meta Graph API failed with ${res.status}`));
  }
  return data as T;
}

async function fetchGraphJsonFromUrl<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(normalizeMetaGraphError(data, `Meta Graph API failed with ${res.status}`));
  }
  return data as T;
}

async function fetchGraphConnectionAll<T>(path: string, fields?: string[], limit = 100, maxPages = 20): Promise<T[]> {
  const url = await buildGraphUrl(path, fields);
  url.searchParams.set('limit', String(limit));

  const rows: T[] = [];
  let nextUrl: string | null = url.toString();
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < maxPages) {
    const page = await fetchGraphJsonFromUrl<MetaGraphConnection<T>>(nextUrl);
    rows.push(...(Array.isArray(page?.data) ? page.data : []));
    nextUrl = normalizeText(page?.paging?.next);
    pagesFetched += 1;
  }

  return rows;
}

async function fetchRecentFormLeads(formId: string, options: MetaLeadSyncOptions): Promise<MetaLeadDetails[]> {
  const url = await buildGraphUrl(`/${formId}/leads`, ['id', 'created_time', 'field_data', 'ad_id', 'form_id', 'campaign_id', 'is_organic']);
  url.searchParams.set('limit', '100');

  const rows: MetaLeadDetails[] = [];
  const maxPagesPerForm = Math.max(1, Math.min(20, options.maxPagesPerForm ?? 3));
  const cutoffMs = options.sinceHours == null
    ? null
    : Date.now() - Math.max(1, options.sinceHours) * 60 * 60 * 1000;

  let nextUrl: string | null = url.toString();
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < maxPagesPerForm) {
    const page = await fetchGraphJsonFromUrl<MetaGraphConnection<MetaLeadDetails>>(nextUrl);
    const pageRows = Array.isArray(page?.data) ? page.data : [];
    let hitCutoff = false;

    for (const lead of pageRows) {
      if (cutoffMs != null) {
        const createdMs = Date.parse(String(lead?.created_time || ''));
        if (Number.isFinite(createdMs) && createdMs < cutoffMs) {
          hitCutoff = true;
          continue;
        }
      }
      rows.push(lead);
    }

    if (hitCutoff) break;

    nextUrl = normalizeText(page?.paging?.next);
    pagesFetched += 1;
  }

  return rows;
}

async function postGraphJson<T>(path: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${cleanPath}`);
  url.searchParams.set('access_token', accessToken || await getMetaAccessToken());

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(normalizeMetaGraphError(data, `Meta Graph API POST failed with ${res.status}`));
  }
  return data as T;
}

export async function sendMetaConversionEvents(events: MetaConversionsEventInput[]): Promise<MetaConversionsApiResponse | null> {
  const pixelId = getMetaPixelId();
  const accessToken = getMetaConversionsAccessToken();
  if (!pixelId || !accessToken || !events.length) return null;

  return postGraphJson<MetaConversionsApiResponse>(`/${pixelId}/events`, { data: events }, accessToken);
}

async function fetchGraphJsonWithToken<T>(token: string, path: string, fields?: string[]): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${cleanPath}`);
  url.searchParams.set('access_token', token);
  if (fields?.length) {
    url.searchParams.set('fields', fields.join(','));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(normalizeMetaGraphError(data, `Meta Graph API failed with ${res.status}`));
  }
  return data as T;
}

export function buildMetaOAuthAuthorizeUrl(redirectUri: string, redirectTo = '/dashboard/meta-leads'): string {
  const payload: MetaOAuthStatePayload = {
    ts: Date.now(),
    redirectTo: redirectTo.startsWith('/') ? redirectTo : '/dashboard/meta-leads',
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', getEnv().JWT_SECRET).update(encodedPayload).digest('base64url');

  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', getMetaAppId());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', `${encodedPayload}.${signature}`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', META_OAUTH_SCOPES.join(','));
  return url.toString();
}

export function verifyMetaOAuthState(state: string | null): { ok: boolean; redirectTo: string } {
  if (!state || !state.includes('.')) {
    return { ok: false, redirectTo: '/dashboard/meta-leads' };
  }

  const [encodedPayload, signature] = state.split('.', 2);
  const expected = createHmac('sha256', getEnv().JWT_SECRET).update(encodedPayload).digest('base64url');
  if (signature !== expected) {
    return { ok: false, redirectTo: '/dashboard/meta-leads' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as MetaOAuthStatePayload;
    const redirectTo = String(payload?.redirectTo || '/dashboard/meta-leads');
    const withinWindow = Date.now() - Number(payload?.ts || 0) <= 15 * 60 * 1000;
    return {
      ok: withinWindow,
      redirectTo: redirectTo.startsWith('/') ? redirectTo : '/dashboard/meta-leads',
    };
  } catch {
    return { ok: false, redirectTo: '/dashboard/meta-leads' };
  }
}

export async function exchangeMetaOAuthCode(code: string, redirectUri: string): Promise<MetaOAuthExchangeResult> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecretRequired();

  const tokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('client_secret', appSecret);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);

  const shortRes = await fetch(tokenUrl.toString(), { cache: 'no-store' });
  const shortData = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || !shortData?.access_token) {
    throw new Error(normalizeMetaGraphError(shortData, 'Meta OAuth code exchange failed'));
  }

  let accessToken = String(shortData.access_token);
  let expiresIn = Number(shortData.expires_in || 0);

  const exchangeUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
  exchangeUrl.searchParams.set('client_id', appId);
  exchangeUrl.searchParams.set('client_secret', appSecret);
  exchangeUrl.searchParams.set('fb_exchange_token', accessToken);

  const longRes = await fetch(exchangeUrl.toString(), { cache: 'no-store' });
  const longData = await longRes.json().catch(() => null);
  if (longRes.ok && longData?.access_token) {
    accessToken = String(longData.access_token);
    expiresIn = Number(longData.expires_in || expiresIn || 0);
  }

  const me = await fetchGraphJsonWithToken<{ id?: string; name?: string }>(accessToken, '/me', ['id', 'name']);
  const permissions = await fetchGraphJsonWithToken<{ data?: Array<{ permission?: string; status?: string }> }>(accessToken, '/me/permissions');
  const pagesData = await fetchGraphJsonWithToken<{ data?: Array<{ id?: string; name?: string; tasks?: string[] }> }>(
    accessToken,
    '/me/accounts',
    ['id', 'name', 'tasks']
  );

  const grantedScopes = Array.isArray(permissions?.data)
    ? permissions.data
        .filter((item) => String(item?.status || '').toLowerCase() === 'granted')
        .map((item) => String(item?.permission || '').trim())
        .filter(Boolean)
    : [];

  const pages = Array.isArray(pagesData?.data)
    ? pagesData.data
        .map((page) => ({
          id: String(page?.id || '').trim(),
          name: normalizeText(page?.name),
          tasks: Array.isArray(page?.tasks) ? page.tasks.map((task) => String(task)) : [],
        }))
        .filter((page) => page.id)
    : [];

  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  await saveMetaTokenConfig({
    accessToken,
    tokenType: 'oauth-user',
    expiresAt,
    userId: normalizeText(me?.id),
    userName: normalizeText(me?.name),
    grantedScopes,
    pages,
    updatedAt: new Date().toISOString(),
  });

  return {
    accessToken,
    expiresAt,
    userId: normalizeText(me?.id),
    userName: normalizeText(me?.name),
    grantedScopes,
    pages,
  };
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

function buildDiscussionNote(sourceLabel: string, ctx: MetaLeadContext, tags: string[]): string {
  const parts = [
    `${sourceLabel} synced`,
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : ctx.campaignId ? `Campaign ID: ${ctx.campaignId}` : null,
    ctx.adName ? `Ad: ${ctx.adName}` : ctx.adId ? `Ad ID: ${ctx.adId}` : null,
    ctx.formName ? `Form: ${ctx.formName}` : ctx.formId ? `Form ID: ${ctx.formId}` : null,
    tags.length ? `Tags: ${tags.join(', ')}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function resolveMetaCourseName(fields: Record<string, string | null>, formName: string | null): string | null {
  return firstValue(fields, [
    'course',
    'course_name',
    'interested_course',
    'training_programme',
    'training_program',
    'program',
    'program_name',
    'preferred_course',
    'preferred_program',
  ]) || formName;
}

function resolveMetaLeadSource(input: {
  rawPayload?: unknown;
  event?: Partial<MetaWebhookLeadEvent> | null;
  fields: Record<string, string | null>;
  ctx: MetaLeadContext;
}): MetaLeadSourceInfo {
  const candidates = [
    normalizeText((input.rawPayload as { object?: unknown } | null)?.object),
    normalizeText(input.event?.campaign_name),
    normalizeText(input.event?.adgroup_name),
    input.fields.utm_source,
    input.fields.platform,
    input.fields.source,
    input.fields.placement,
    input.ctx.campaignName,
    input.ctx.formName,
    input.ctx.pageName,
    input.ctx.adName,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  const looksInstagram = candidates.some((value) =>
    value.includes('instagram')
    || value.includes('insta')
    || value.includes('ig lead')
    || value.includes('ig form')
    || value === 'ig'
  );

  if (looksInstagram) {
    return {
      sourceLabel: 'Instagram Leads',
      contactSource: 'Instagram Instant Form',
      sourceTag: 'source:instagram',
    };
  }

  const looksFacebook = candidates.some((value) =>
    value.includes('facebook')
    || value === 'fb'
    || value.includes('fb lead')
    || value.includes('fb form')
  );

  if (looksFacebook) {
    return {
      sourceLabel: 'Facebook Leads',
      contactSource: 'Facebook Instant Form',
      sourceTag: 'source:facebook',
    };
  }

  return {
    sourceLabel: META_SOURCE_LABEL,
    contactSource: META_CONTACT_SOURCE,
    sourceTag: 'source:meta',
  };
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

function parseJsonObject(raw: unknown): Record<string, string | null> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, value == null ? null : String(value)])
    );
  } catch {
    return {};
  }
}

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function backfillStoredMetaLeadSources(): Promise<number> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
       meta_lead_id,
       source_label,
       contact_source,
       campaign_id,
       campaign_name,
       form_id,
       form_name,
       page_id,
       page_name,
       ad_id,
       ad_name,
       adset_id,
       adset_name,
       fields_json,
       tags_json
     FROM ${META_LEADS_TABLE}
     WHERE COALESCE(NULLIF(TRIM(source_label), ''), ?) = ?`,
    [META_SOURCE_LABEL, META_SOURCE_LABEL]
  );

  let updated = 0;
  for (const row of rows as any[]) {
    const fields = parseJsonObject(row.fields_json);
    const ctx: MetaLeadContext = {
      formId: normalizeText(row.form_id),
      formName: normalizeText(row.form_name),
      pageId: normalizeText(row.page_id),
      pageName: normalizeText(row.page_name),
      adId: normalizeText(row.ad_id),
      adName: normalizeText(row.ad_name),
      adsetId: normalizeText(row.adset_id),
      adsetName: normalizeText(row.adset_name),
      campaignId: normalizeText(row.campaign_id),
      campaignName: normalizeText(row.campaign_name),
    };

    const sourceInfo = resolveMetaLeadSource({ fields, ctx });
    const existingTags = parseJsonArray(row.tags_json).filter((tag) => !/^source:/i.test(String(tag)));
    const tags = Array.from(new Set<string>([...existingTags, sourceInfo.sourceTag])).sort();
    const nextSourceLabel = sourceInfo.sourceLabel;
    const nextContactSource = sourceInfo.contactSource;
    const currentSourceLabel = normalizeText(row.source_label) ?? META_SOURCE_LABEL;
    const currentContactSource = normalizeText(row.contact_source) ?? META_CONTACT_SOURCE;
    const currentTagsJson = JSON.stringify(parseJsonArray(row.tags_json));
    const nextTagsJson = JSON.stringify(tags);

    if (
      currentSourceLabel === nextSourceLabel
      && currentContactSource === nextContactSource
      && currentTagsJson === nextTagsJson
    ) {
      continue;
    }

    await pool.query(
      `UPDATE ${META_LEADS_TABLE}
       SET source_label = ?,
           contact_source = ?,
           tags_json = ?
       WHERE meta_lead_id = ?`,
      [nextSourceLabel, nextContactSource, nextTagsJson, row.meta_lead_id]
    );
    updated += 1;
  }

  return updated;
}

async function upsertMetaLeadRow(params: {
  leadId: string;
  inquiryId: number | null;
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
       inquiry_id = COALESCE(VALUES(inquiry_id), inquiry_id),
       duplicate_of_inquiry_id = COALESCE(VALUES(duplicate_of_inquiry_id), duplicate_of_inquiry_id),
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
  const sourceInfo = resolveMetaLeadSource({ rawPayload, event, fields, ctx });
  const tags = Array.from(new Set([...buildTags(fields, ctx), sourceInfo.sourceTag])).sort();
  const utm = Object.fromEntries(Object.entries(fields).filter(([key]) => key.startsWith('utm_')));
  const discussion = buildDiscussionNote(sourceInfo.sourceLabel, ctx, tags);

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
      Inquiry_From: sourceInfo.contactSource,
      Inquiry_Type: sourceInfo.sourceLabel,
      Course_Id: duplicate.courseId || courseId,
      Discussion: discussion,
    });
  } else {
    const createPayload: CreateInquiryInput = {
      Student_Name: studentName,
      Present_Mobile: mobile,
      Email: email,
      Inquiry_Dt: inquiryDate,
      Inquiry_From: sourceInfo.contactSource,
      Inquiry_Type: sourceInfo.sourceLabel,
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

  try {
    await sendMetaConversionEvents([
      {
        event_name: 'Lead',
        event_time: Math.floor(new Date(lead.created_time || event.created_time || Date.now()).getTime() / 1000),
        action_source: 'system_generated',
        event_id: `meta-lead-${leadId}`,
        user_data: buildMetaEventUserData({
          email,
          mobile,
          inquiryId,
          leadId,
        }),
        custom_data: {
          source_label: sourceInfo.sourceLabel,
          contact_source: sourceInfo.contactSource,
          inquiry_id: inquiryId,
          lead_id: leadId,
          course_name: courseName,
          duplicate: Boolean(duplicate),
          created,
          campaign_name: ctx.campaignName,
          form_name: ctx.formName,
          webhook_source: extractWebhookSourceLabel(rawPayload),
        },
      },
    ]);
  } catch (error) {
    console.error('Meta conversions event error:', error);
  }

  await upsertMetaLeadRow({
    leadId,
    inquiryId,
    duplicateOfInquiryId: duplicate?.inquiryId ?? null,
    sourceLabel: sourceInfo.sourceLabel,
    contactSource: sourceInfo.contactSource,
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
  const rawAccountId = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!rawAccountId) {
    throw new Error('META_AD_ACCOUNT_ID is not configured');
  }
  const accountId = normalizeMetaAdAccountId(rawAccountId);

  const url = await buildGraphUrl(`/act_${accountId}/insights`, [
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

export async function syncLiveMetaLeadsToDb(options: MetaLeadSyncOptions = {}): Promise<MetaLeadSyncSummary> {
  const pages = await getMetaLeadPages();
  const summary: MetaLeadSyncSummary = {
    pages: pages.length,
    forms: 0,
    leadsProcessed: 0,
    errors: 0,
    sinceHours: options.sinceHours ?? null,
  };

  const formsByPage = await Promise.all(
    pages.map(async (page) => ({
      page,
      forms: await fetchGraphConnectionAll<MetaLeadFormRecord>(`/${page.id}/leadgen_forms`, ['id', 'name']),
    }))
  );

  const leadSyncJobs = formsByPage.flatMap(({ page, forms }) =>
    forms.map(async (form) => {
      const formId = normalizeText(form.id);
      if (!formId) return;
      summary.forms += 1;

      try {
        const leads = await fetchRecentFormLeads(formId, options);

        await Promise.all(leads.map(async (lead) => {
          const leadId = normalizeText(lead.id);
          if (!leadId) return;
          summary.leadsProcessed += 1;

          const fields = mapLeadFields(lead.field_data);
          const fallbackFormName = normalizeText(form.name);
          const ctx = await fetchLeadContext({
            form_id: formId,
            page_id: page.id,
          }, lead);
          ctx.formName = ctx.formName || fallbackFormName;
          ctx.pageName = ctx.pageName || page.name;
          const sourceInfo = resolveMetaLeadSource({ fields, ctx });

          await upsertMetaLeadRow({
            leadId,
            inquiryId: null,
            duplicateOfInquiryId: null,
            sourceLabel: sourceInfo.sourceLabel,
            contactSource: sourceInfo.contactSource,
            studentName: firstValue(fields, ['full_name', 'full_name_1', 'name'])
              || [firstValue(fields, ['first_name']), firstValue(fields, ['last_name'])].filter(Boolean).join(' ').trim()
              || 'Meta Lead',
            mobile: normalizeDigits(firstValue(fields, ['phone_number', 'phone', 'mobile', 'whatsapp_number', 'whatsapp'])),
            email: normalizeEmail(firstValue(fields, ['email', 'email_address'])),
            courseName: resolveMetaCourseName(fields, ctx.formName || fallbackFormName),
            leadCreatedTime: normalizeText(lead.created_time),
            ctx,
            tags: Array.from(new Set([...buildTags(fields, ctx), sourceInfo.sourceTag])).sort(),
            utm: Object.fromEntries(Object.entries(fields).filter(([key]) => key.startsWith('utm_'))),
            fields,
            payload: { lead, source: 'graph-fallback' },
            duplicateReason: null,
          });
        }));
      } catch (error) {
        summary.errors += 1;
        console.error('Meta live sync failed for form', {
          pageId: page.id,
          formId,
          error: error instanceof Error ? error.message : error,
        });
      }
    })
  );

  await Promise.all(leadSyncJobs);
  return summary;
}

function getConfiguredMetaPageIds(): string[] {
  return [process.env.META_PAGE_ID, process.env.META_PAGE_IDS]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getMetaLeadPages(): Promise<Array<{ id: string; name: string | null }>> {
  const pages = new Map<string, string | null>();

  for (const pageId of getConfiguredMetaPageIds()) {
    pages.set(pageId, null);
  }

  const stored = await getStoredMetaTokenConfig();
  for (const page of stored?.pages || []) {
    if (page.id) {
      pages.set(page.id, page.name || pages.get(page.id) || null);
    }
  }

  if (pages.size === 0) {
    const accountPages = await fetchGraphConnectionAll<MetaPageRecord>('/me/accounts', ['id', 'name']);
    for (const page of accountPages) {
      const id = normalizeText(page.id);
      if (id) {
        pages.set(id, normalizeText(page.name));
      }
    }
  }

  return Array.from(pages.entries()).map(([id, name]) => ({ id, name }));
}

export async function listMetaLeads(params: MetaLeadListParams): Promise<MetaLeadListResult> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const {
    page,
    limit,
    search = '',
    leadTag = '',
    source = '',
    statusId = '',
    dateFrom = '',
    dateTo = '',
    training = '',
    duplicatesOnly = false,
  } = params;

  const [sourceCoverageRows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN LOWER(COALESCE(NULLIF(TRIM(source_label), ''), ?)) <> LOWER(?) THEN 1 ELSE 0 END) AS classified
     FROM ${META_LEADS_TABLE}`,
    [META_SOURCE_LABEL, META_SOURCE_LABEL]
  );
  const sourceCoverage = (sourceCoverageRows as any[])[0] || {};
  if (Number(sourceCoverage.total || 0) > 0 && Number(sourceCoverage.classified || 0) === 0) {
    await backfillStoredMetaLeadSources();
  }

  const conditions: string[] = ['1=1'];
  const queryParams: any[] = [];

  if (search) {
    conditions.push(`(
      LOWER(COALESCE(m.student_name,'')) LIKE ?
      OR LOWER(COALESCE(m.mobile,'')) LIKE ?
      OR LOWER(COALESCE(m.email,'')) LIKE ?
      OR CAST(COALESCE(m.inquiry_id, 0) AS CHAR) LIKE ?
    )`);
    const like = `%${search.toLowerCase()}%`;
    queryParams.push(like, like, like, like);
  }
  if (leadTag) {
    conditions.push(`(
      LOWER(COALESCE(m.tags_json,'')) LIKE ?
      OR LOWER(COALESCE(m.campaign_name,'')) LIKE ?
      OR LOWER(COALESCE(m.form_name,'')) LIKE ?
    )`);
    const like = `%${leadTag.toLowerCase()}%`;
    queryParams.push(like, like, like);
  }
  if (source) {
    conditions.push(`LOWER(COALESCE(m.source_label,'')) = ?`);
    queryParams.push(source.toLowerCase());
  }
  if (statusId) {
    conditions.push(`CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) = ?`);
    queryParams.push(Number(statusId));
  }
  if (dateFrom) {
    conditions.push(`DATE(COALESCE(NULLIF(m.lead_created_time,''), m.created_at)) >= ?`);
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`DATE(COALESCE(NULLIF(m.lead_created_time,''), m.created_at)) <= ?`);
    queryParams.push(dateTo);
  }
  if (training) {
    conditions.push(`LOWER(COALESCE(m.course_name,'')) = ?`);
    queryParams.push(training.toLowerCase());
  }
  if (duplicatesOnly) {
    conditions.push(`m.duplicate_of_inquiry_id IS NOT NULL`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM ${META_LEADS_TABLE} m
     LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
     ${whereClause}`,
    queryParams
  );
  let total = Number((countRows as any[])[0]?.total || 0);

  if (total > 0) {
    const [incompleteRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ${META_LEADS_TABLE}
       WHERE COALESCE(NULLIF(TRIM(campaign_name), ''), NULLIF(TRIM(course_name), '')) IS NULL`
    );
    const incompleteTotal = Number((incompleteRows as any[])[0]?.total || 0);
    if (incompleteTotal > 0) {
      await syncLiveMetaLeadsToDb();
    }
  }

  if (total === 0) {
    await syncLiveMetaLeadsToDb();

    const [refreshedCountRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ${META_LEADS_TABLE} m
       LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
       ${whereClause}`,
      queryParams
    );
    total = Number((refreshedCountRows as any[])[0]?.total || 0);
  }

  const [rows] = await pool.query(
    `SELECT
       m.meta_lead_id AS MetaLead_Id,
       COALESCE(m.inquiry_id, 0) AS Student_Id,
       COALESCE(NULLIF(TRIM(m.student_name),''), NULLIF(TRIM(si.Student_Name),''), 'Meta Lead') AS Student_Name,
       COALESCE(NULLIF(TRIM(m.course_name),''), NULLIF(TRIM(m.form_name),'')) AS CourseName,
       COALESCE(NULLIF(TRIM(m.lead_created_time),''), CAST(m.created_at AS CHAR)) AS Inquiry_Dt,
       NULLIF(TRIM(m.mobile),'') AS Present_Mobile,
       NULLIF(TRIM(m.email),'') AS Email,
       m.contact_source AS Inquiry_From,
       m.source_label AS Inquiry_Type,
       CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) AS Status_id,
       si.Discussion AS Discussion,
       COALESCE(NULLIF(TRIM(m.campaign_name),''), NULLIF(TRIM(m.campaign_id),'')) AS MetaCampaignName,
       NULLIF(TRIM(m.form_name),'') AS MetaFormName,
       m.tags_json AS LeadTagsJson,
       m.duplicate_of_inquiry_id IS NOT NULL AS IsDuplicateLead
     FROM ${META_LEADS_TABLE} m
     LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
     ${whereClause}
     ORDER BY COALESCE(NULLIF(m.lead_created_time,''), CAST(m.created_at AS CHAR)) DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  const [trainingRows] = await pool.query(
    `SELECT DISTINCT course_name
     FROM ${META_LEADS_TABLE}
     WHERE course_name IS NOT NULL AND TRIM(course_name) != ''
     ORDER BY course_name`
  );

  const [sourceRows] = await pool.query(
    `SELECT DISTINCT source_label
     FROM ${META_LEADS_TABLE}
     WHERE source_label IS NOT NULL AND TRIM(source_label) != ''
     ORDER BY source_label`
  );

  const statusOptions = Object.entries(FALLBACK_STATUSES)
    .map(([id, label]) => ({ id: Number(id), label }))
    .sort((a, b) => a.id - b.id);

  const mappedRows: MetaLeadListRow[] = (rows as any[]).map((row: any) => {
    let tags: string[] = [];
    try {
      const parsed = JSON.parse(row.LeadTagsJson || '[]');
      tags = Array.isArray(parsed) ? parsed.map((tag) => String(tag)).filter(Boolean) : [];
    } catch {
      tags = [];
    }

    const statusIdNum = row.Status_id == null ? null : Number(row.Status_id);
    return {
      MetaLead_Id: String(row.MetaLead_Id || ''),
      Student_Id: Number(row.Student_Id || 0),
      Student_Name: String(row.Student_Name || 'Meta Lead'),
      CourseName: row.CourseName ?? null,
      Inquiry_Dt: row.Inquiry_Dt ?? null,
      Present_Mobile: row.Present_Mobile ?? null,
      Email: row.Email ?? null,
      Inquiry_From: row.Inquiry_From ?? null,
      Inquiry_Type: row.Inquiry_Type ?? null,
      Status_id: statusIdNum,
      StatusLabel: statusIdNum != null ? (FALLBACK_STATUSES[statusIdNum] || `Status ${statusIdNum}`) : 'Open',
      Discussion: row.Discussion ?? null,
      MetaCampaignName: row.MetaCampaignName ?? null,
      MetaFormName: row.MetaFormName ?? null,
      LeadTags: tags,
      IsDuplicateLead: Boolean(row.IsDuplicateLead),
    };
  });

  return {
    rows: mappedRows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filters: {
      trainings: (trainingRows as any[]).map((row: any) => String(row.course_name).trim()).filter(Boolean),
      sources: (sourceRows as any[]).map((row: any) => String(row.source_label).trim()).filter(Boolean),
      statusOptions,
    },
  };
}

export async function getMetaLeadDetail(metaLeadId: string): Promise<MetaLeadDetailResult | null> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);

  const [rows] = await pool.query(
    `SELECT
       m.meta_lead_id AS MetaLead_Id,
       COALESCE(m.inquiry_id, 0) AS Student_Id,
       COALESCE(NULLIF(TRIM(m.student_name),''), NULLIF(TRIM(si.Student_Name),''), 'Meta Lead') AS Student_Name,
       COALESCE(NULLIF(TRIM(m.course_name),''), NULLIF(TRIM(m.form_name),'')) AS CourseName,
       COALESCE(NULLIF(TRIM(m.lead_created_time),''), CAST(m.created_at AS CHAR)) AS Inquiry_Dt,
       NULLIF(TRIM(m.mobile),'') AS Present_Mobile,
       NULLIF(TRIM(m.email),'') AS Email,
       m.contact_source AS Inquiry_From,
       m.source_label AS Inquiry_Type,
       CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) AS Status_id,
       si.Discussion AS Discussion,
       COALESCE(NULLIF(TRIM(m.campaign_name),''), NULLIF(TRIM(m.campaign_id),'')) AS MetaCampaignName,
       NULLIF(TRIM(m.campaign_id),'') AS MetaCampaignId,
       NULLIF(TRIM(m.form_name),'') AS MetaFormName,
       NULLIF(TRIM(m.form_id),'') AS MetaFormId,
       NULLIF(TRIM(m.page_name),'') AS MetaPageName,
       NULLIF(TRIM(m.page_id),'') AS MetaPageId,
       NULLIF(TRIM(m.ad_name),'') AS MetaAdName,
       NULLIF(TRIM(m.ad_id),'') AS MetaAdId,
       NULLIF(TRIM(m.adset_name),'') AS MetaAdsetName,
       NULLIF(TRIM(m.adset_id),'') AS MetaAdsetId,
       m.tags_json AS LeadTagsJson,
       m.duplicate_of_inquiry_id AS DuplicateOfInquiryId,
       m.duplicate_of_inquiry_id IS NOT NULL AS IsDuplicateLead,
       m.last_error AS LastError,
       CAST(m.notifications_sent_at AS CHAR) AS NotificationsSentAt,
       CAST(m.synced_at AS CHAR) AS SyncedAt,
       CAST(m.created_at AS CHAR) AS CreatedAt,
       m.utm_json AS UTMJson,
       m.fields_json AS FieldsJson,
       m.payload_json AS PayloadJson
     FROM ${META_LEADS_TABLE} m
     LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
     WHERE m.meta_lead_id = ?
     LIMIT 1`,
    [metaLeadId]
  );

  const row = (rows as any[])[0];
  if (!row) return null;

  let tags: string[] = [];
  let utm: Record<string, string | null> = {};
  let fields: Record<string, string | null> = {};
  let payload: unknown = null;

  try {
    const parsed = JSON.parse(row.LeadTagsJson || '[]');
    tags = Array.isArray(parsed) ? parsed.map((tag) => String(tag)).filter(Boolean) : [];
  } catch {}

  try {
    const parsed = JSON.parse(row.UTMJson || '{}');
    utm = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  try {
    const parsed = JSON.parse(row.FieldsJson || '{}');
    fields = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  try {
    payload = row.PayloadJson ? JSON.parse(row.PayloadJson) : null;
  } catch {
    payload = row.PayloadJson || null;
  }

  const statusIdNum = row.Status_id == null ? null : Number(row.Status_id);
  return {
    MetaLead_Id: String(row.MetaLead_Id || ''),
    Student_Id: Number(row.Student_Id || 0),
    Student_Name: String(row.Student_Name || 'Meta Lead'),
    CourseName: row.CourseName ?? null,
    Inquiry_Dt: row.Inquiry_Dt ?? null,
    Present_Mobile: row.Present_Mobile ?? null,
    Email: row.Email ?? null,
    Inquiry_From: row.Inquiry_From ?? null,
    Inquiry_Type: row.Inquiry_Type ?? null,
    Status_id: statusIdNum,
    StatusLabel: statusIdNum != null ? (FALLBACK_STATUSES[statusIdNum] || `Status ${statusIdNum}`) : 'Open',
    Discussion: row.Discussion ?? null,
    MetaCampaignName: row.MetaCampaignName ?? null,
    MetaCampaignId: row.MetaCampaignId ?? null,
    MetaFormName: row.MetaFormName ?? null,
    MetaFormId: row.MetaFormId ?? null,
    MetaPageName: row.MetaPageName ?? null,
    MetaPageId: row.MetaPageId ?? null,
    MetaAdName: row.MetaAdName ?? null,
    MetaAdId: row.MetaAdId ?? null,
    MetaAdsetName: row.MetaAdsetName ?? null,
    MetaAdsetId: row.MetaAdsetId ?? null,
    LeadTags: tags,
    IsDuplicateLead: Boolean(row.IsDuplicateLead),
    DuplicateOfInquiryId: row.DuplicateOfInquiryId == null ? null : Number(row.DuplicateOfInquiryId),
    LastError: row.LastError ?? null,
    NotificationsSentAt: row.NotificationsSentAt ?? null,
    SyncedAt: row.SyncedAt ?? null,
    CreatedAt: row.CreatedAt ?? null,
    UTM: utm,
    Fields: fields,
    Payload: payload,
  };
}

export async function updateMetaLeadDetail(metaLeadId: string, input: MetaLeadUpdateInput): Promise<MetaLeadDetailResult | null> {
  await ensureMetaLeadTables();
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT
       meta_lead_id,
       student_name,
       course_name,
       mobile,
       email,
       form_id,
       form_name,
       page_id,
       page_name,
       ad_id,
       ad_name,
       adset_id,
       adset_name,
       campaign_id,
       campaign_name,
       fields_json,
       utm_json
     FROM ${META_LEADS_TABLE}
     WHERE meta_lead_id = ?
     LIMIT 1`,
    [metaLeadId]
  );

  const row = (rows as any[])[0];
  if (!row) return null;

  let existingFields: Record<string, string | null> = {};
  let existingUtm: Record<string, string | null> = {};

  try {
    const parsed = JSON.parse(row.fields_json || '{}');
    existingFields = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  try {
    const parsed = JSON.parse(row.utm_json || '{}');
    existingUtm = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  const nextFields = input.fields ?? existingFields;
  const nextUtm = input.utm ?? existingUtm;
  const ctx: MetaLeadContext = {
    formId: normalizeText(row.form_id),
    formName: normalizeText(row.form_name),
    pageId: normalizeText(row.page_id),
    pageName: normalizeText(row.page_name),
    adId: normalizeText(row.ad_id),
    adName: normalizeText(row.ad_name),
    adsetId: normalizeText(row.adset_id),
    adsetName: normalizeText(row.adset_name),
    campaignId: normalizeText(row.campaign_id),
    campaignName: normalizeText(row.campaign_name),
  };

  const fallbackName = [firstValue(nextFields, ['first_name']), firstValue(nextFields, ['last_name'])]
    .filter(Boolean)
    .join(' ')
    .trim();
  const studentName = normalizeText(input.studentName)
    ?? normalizeText(row.student_name)
    ?? firstValue(nextFields, ['full_name', 'full_name_1', 'name'])
    ?? (fallbackName || null)
    ?? 'Meta Lead';
  const courseName = normalizeText(input.courseName)
    ?? normalizeText(row.course_name)
    ?? resolveMetaCourseName(nextFields, ctx.formName);
  const mobile = normalizeDigits(input.mobile)
    ?? normalizeText(row.mobile)
    ?? normalizeDigits(firstValue(nextFields, ['phone_number', 'phone', 'mobile', 'whatsapp_number', 'whatsapp']));
  const email = normalizeEmail(input.email)
    ?? normalizeText(row.email)
    ?? normalizeEmail(firstValue(nextFields, ['email', 'email_address']));
  const tags = buildTags(nextFields, ctx);

  await pool.query(
    `UPDATE ${META_LEADS_TABLE}
     SET student_name = ?,
         course_name = ?,
         mobile = ?,
         email = ?,
         fields_json = ?,
         utm_json = ?,
         tags_json = ?
     WHERE meta_lead_id = ?`,
    [
      studentName,
      courseName,
      mobile,
      email,
      JSON.stringify(nextFields),
      JSON.stringify(nextUtm),
      JSON.stringify(tags),
      metaLeadId,
    ]
  );

  if (input.statusId != null) {
    const inquiryTable = await resolveInquiryTableName(pool);
    await pool.query(
      `UPDATE \`${inquiryTable}\` si
       INNER JOIN ${META_LEADS_TABLE} m ON m.inquiry_id = si.Inquiry_Id
       SET si.OnlineState = ?
       WHERE m.meta_lead_id = ?`,
      [String(input.statusId), metaLeadId]
    );
  }

  return getMetaLeadDetail(metaLeadId);
}

export interface DiscussionEntry {
  id: number;
  date: string | null;
  nextDate: string | null;
  note: string;
  createdAt: string | null;
}

export async function getMetaLeadDiscussions(metaLeadId: string): Promise<DiscussionEntry[]> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT d.id, d.date, d.nextdate AS nextDate, d.discussion AS note, d.created_date AS createdAt
     FROM awt_inquirydiscussion d
     INNER JOIN ${META_LEADS_TABLE} m ON m.inquiry_id = d.Inquiry_id
     WHERE m.meta_lead_id = ? AND d.deleted = 0
     ORDER BY d.id DESC`,
    [metaLeadId]
  );
  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    date: r.date ? String(r.date).slice(0, 10) : null,
    nextDate: r.nextDate ? String(r.nextDate).slice(0, 10) : null,
    note: String(r.note || ''),
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }));
}

export async function addMetaLeadDiscussionNote(
  metaLeadId: string,
  note: string,
  nextDate: string | null
): Promise<void> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const [leadRows] = await pool.query(
    `SELECT inquiry_id FROM ${META_LEADS_TABLE} WHERE meta_lead_id = ? LIMIT 1`,
    [metaLeadId]
  );
  const lead = (leadRows as any[])[0];
  if (!lead?.inquiry_id) return;
  const safeNext = nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate) ? nextDate : null;
  await pool.query(
    `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, nextdate, discussion, deleted, created_by, created_date)
     VALUES (?, CURDATE(), ?, ?, 0, 1, NOW())`,
    [lead.inquiry_id, safeNext, note.trim()]
  );
}
