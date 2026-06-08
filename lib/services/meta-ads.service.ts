/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { getPool, cached, invalidateCache } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { createInquiry, updateInquiry, type CreateInquiryInput } from '@/lib/services/inquiry.service';
import { sendAdmissionFormEmail, sendMetaLeadThankYouEmail } from '@/lib/mailer';

const META_LEADS_TABLE = 'meta_ads_lead_sync';
const META_SETTINGS_TABLE = 'meta_ads_settings';
const META_CAMPAIGN_PUBLISH_LOG_TABLE = 'meta_ads_campaign_publish_log';
const META_LEAD_EMAIL_CLICK_LOG_TABLE = 'meta_ads_lead_email_click_log';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';
const META_SOURCE_LABEL = 'Meta Ads';
const META_CONTACT_SOURCE = 'Meta Instant Form';
const DEFAULT_META_LEAD_THANK_YOU_URL = 'https://suvidya.ac.in/';
const META_OAUTH_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'leads_retrieval',
  'pages_read_engagement',
  'pages_show_list',
];

const META_CAMPAIGN_OBJECTIVES = [
  'OUTCOME_AWARENESS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_SALES',
] as const;

const META_CAMPAIGN_STATUSES = ['PAUSED', 'ACTIVE'] as const;
const META_DELIVERY_STATUSES = ['PAUSED', 'ACTIVE'] as const;

const META_CALL_TO_ACTION_TYPES = [
  'LEARN_MORE',
  'SIGN_UP',
  'APPLY_NOW',
  'CONTACT_US',
  'GET_QUOTE',
  'BOOK_TRAVEL',
] as const;

const META_BILLING_EVENTS = ['IMPRESSIONS', 'LINK_CLICKS'] as const;
const META_OPTIMIZATION_GOALS = ['QUALITY_LEAD', 'LEAD_GENERATION', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'] as const;
const META_DESTINATION_TYPES = ['ON_AD', 'WEBSITE'] as const;

const META_SPECIAL_AD_CATEGORIES = [
  'NONE',
  'CREDIT',
  'EMPLOYMENT',
  'HOUSING',
  'ISSUES_ELECTIONS_POLITICS',
] as const;

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

interface DuplicateMatchOptions {
  studentName?: string | null;
  preferStrongMatch?: boolean;
}

interface MetaLeadDeliveryState {
  notificationsSentAt: string | null;
  applicantEmailSentAt: string | null;
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
  35: 'Refund', 40: 'Counselling Done', 41: 'Call Not Picked Up',
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
  StudentMaster_Id: number;
  Student_Name: string;
  CourseName: string | null;
  TrainingProgramme: string | null;
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
  ApplicantEmailSentAt: string | null;
  City: string | null;
  LeadFields: Record<string, string | null>;
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
  StudentMaster_Id: number;
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
  city?: string | null;
  discussion?: string | null;
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

export interface MetaCampaignPublishInput {
  name: string;
  objective: (typeof META_CAMPAIGN_OBJECTIVES)[number];
  status?: (typeof META_CAMPAIGN_STATUSES)[number] | null;
  specialAdCategories?: Array<(typeof META_SPECIAL_AD_CATEGORIES)[number]> | null;
  pageId?: string | null;
  websiteUrl?: string | null;
  instantForm?: MetaInstantFormPublishInput | null;
  creative?: MetaAdCreativePublishInput | null;
  adSet?: MetaAdSetPublishInput | null;
  ad?: MetaAdPublishInput | null;
}

export interface MetaInstantFormPublishInput {
  name: string;
  privacyPolicyUrl: string;
  thankYouTitle?: string | null;
  thankYouBody?: string | null;
  followUpActionUrl?: string | null;
  questionKeys?: string[] | null;
}

export interface MetaAdCreativePublishInput {
  name: string;
  message: string;
  headline?: string | null;
  linkUrl?: string | null;
  imageHash?: string | null;
  imageUrl?: string | null;
  callToActionType?: (typeof META_CALL_TO_ACTION_TYPES)[number] | null;
}

export interface MetaAdSetPublishInput {
  name: string;
  dailyBudget: number;
  countries: string[];
  billingEvent?: (typeof META_BILLING_EVENTS)[number] | null;
  optimizationGoal?: (typeof META_OPTIMIZATION_GOALS)[number] | null;
  destinationType?: (typeof META_DESTINATION_TYPES)[number] | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: (typeof META_DELIVERY_STATUSES)[number] | null;
}

export interface MetaAdPublishInput {
  name: string;
  status?: (typeof META_DELIVERY_STATUSES)[number] | null;
}

export interface MetaCampaignPublishResult {
  campaignId: string;
  campaignName: string;
  objective: string;
  status: string;
  effectiveStatus: string;
  specialAdCategories: string[];
  adAccountId: string;
  pageId: string | null;
  instantFormId: string | null;
  instantFormName: string | null;
  creativeId: string | null;
  creativeName: string | null;
  adSetId: string | null;
  adSetName: string | null;
  adId: string | null;
  adName: string | null;
  message: string;
}

export interface MetaCampaignPublishLogRow {
  id: number;
  campaignId: string | null;
  campaignName: string;
  objective: string;
  publishStatus: string;
  requestedBy: number | null;
  createdAt: string;
  errorMessage: string | null;
}

interface NormalizedMetaCampaignPublishInput {
  name: string;
  objective: (typeof META_CAMPAIGN_OBJECTIVES)[number];
  status: (typeof META_CAMPAIGN_STATUSES)[number];
  specialAdCategories: Array<(typeof META_SPECIAL_AD_CATEGORIES)[number]>;
  pageId: string | null;
  websiteUrl: string | null;
  instantForm: NormalizedMetaInstantFormPublishInput | null;
  creative: NormalizedMetaAdCreativePublishInput | null;
  adSet: NormalizedMetaAdSetPublishInput | null;
  ad: NormalizedMetaAdPublishInput | null;
}

interface NormalizedMetaInstantFormPublishInput {
  name: string;
  privacyPolicyUrl: string;
  thankYouTitle: string;
  thankYouBody: string;
  followUpActionUrl: string | null;
  questionKeys: string[];
}

interface NormalizedMetaAdCreativePublishInput {
  name: string;
  message: string;
  headline: string | null;
  linkUrl: string | null;
  imageHash: string | null;
  imageUrl: string | null;
  callToActionType: (typeof META_CALL_TO_ACTION_TYPES)[number];
}

interface NormalizedMetaAdSetPublishInput {
  name: string;
  dailyBudget: number;
  countries: string[];
  billingEvent: (typeof META_BILLING_EVENTS)[number];
  optimizationGoal: (typeof META_OPTIMIZATION_GOALS)[number];
  destinationType: (typeof META_DESTINATION_TYPES)[number];
  startTime: string | null;
  endTime: string | null;
  status: (typeof META_DELIVERY_STATUSES)[number];
}

interface NormalizedMetaAdPublishInput {
  name: string;
  status: (typeof META_DELIVERY_STATUSES)[number];
}

interface MetaPublishPipelineIds {
  instantFormId: string | null;
  creativeId: string | null;
  adSetId: string | null;
  adId: string | null;
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

interface MetaGraphCreateResponse {
  id?: string;
  success?: boolean;
  effective_status?: string;
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

async function hasTableColumn(
  pool: ReturnType<typeof getPool>,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number((rows as any[])[0]?.cnt || 0) > 0;
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

function normalizeUrl(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
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

function getMetaAdAccountIdRequired(): string {
  const rawAccountId = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!rawAccountId) {
    throw new Error('META_AD_ACCOUNT_ID is not configured');
  }
  return normalizeMetaAdAccountId(rawAccountId);
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
  // Phase 1: create all four tables in parallel (all idempotent).
  await Promise.all([
    pool.query(`
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
        applicant_email_sent_at TIMESTAMP NULL,
        applicant_email_last_error TEXT NULL,
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
    `),
    pool.query(`
      CREATE TABLE IF NOT EXISTS ${META_SETTINGS_TABLE} (
        setting_key VARCHAR(100) NOT NULL,
        setting_value LONGTEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
    pool.query(`
      CREATE TABLE IF NOT EXISTS ${META_CAMPAIGN_PUBLISH_LOG_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        meta_campaign_id VARCHAR(191) NULL,
        campaign_name VARCHAR(255) NOT NULL,
        objective VARCHAR(64) NOT NULL,
        publish_status VARCHAR(32) NOT NULL,
        effective_status VARCHAR(64) NULL,
        ad_account_id VARCHAR(64) NOT NULL,
        requested_by INT NULL,
        request_json LONGTEXT NULL,
        response_json LONGTEXT NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_meta_campaign_publish_campaign_id (meta_campaign_id),
        KEY idx_meta_campaign_publish_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
    pool.query(`
      CREATE TABLE IF NOT EXISTS ${META_LEAD_EMAIL_CLICK_LOG_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        meta_lead_id VARCHAR(191) NOT NULL,
        inquiry_id INT NULL,
        destination_url TEXT NOT NULL,
        ip_address VARCHAR(100) NULL,
        user_agent VARCHAR(512) NULL,
        referer TEXT NULL,
        clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_meta_lead_email_click_lead_id (meta_lead_id),
        KEY idx_meta_lead_email_click_inquiry_id (inquiry_id),
        KEY idx_meta_lead_email_click_clicked_at (clicked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
  ]);
  // Phase 2: migration columns — must run after the leads table is guaranteed to exist.
  await Promise.all([
    pool.query(`ALTER TABLE ${META_LEADS_TABLE} ADD COLUMN IF NOT EXISTS applicant_email_sent_at TIMESTAMP NULL`),
    pool.query(`ALTER TABLE ${META_LEADS_TABLE} ADD COLUMN IF NOT EXISTS applicant_email_last_error TEXT NULL`),
    pool.query(`ALTER TABLE ${META_LEADS_TABLE} ADD COLUMN IF NOT EXISTS online_state INT NULL`),
  ]);
  metaTablesReady = true;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getMetaLeadThankYouDestinationUrl(): string {
  const rawUrl = process.env.META_LEAD_THANK_YOU_URL?.trim() || DEFAULT_META_LEAD_THANK_YOU_URL;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('META_LEAD_THANK_YOU_URL must be a valid absolute URL');
  }

  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'meta_lead_email');
  if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'email');
  if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', 'sit_meta_lead_thank_you');
  return url.toString();
}

function createMetaLeadEmailClickToken(input: {
  leadId: string;
  inquiryId: number;
  destinationUrl: string;
}): string {
  const payload = base64UrlEncode(JSON.stringify({
    leadId: input.leadId,
    inquiryId: input.inquiryId,
    destinationUrl: input.destinationUrl,
    issuedAt: Date.now(),
  }));
  const signature = createHmac('sha256', getEnv().JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function parseMetaLeadEmailClickToken(token: string): {
  leadId: string;
  inquiryId: number;
  destinationUrl: string;
} {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('Invalid lead email click token');

  const expectedSignature = createHmac('sha256', getEnv().JWT_SECRET).update(payload).digest();
  const providedSignature = Buffer.from(signature, 'base64url');
  if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('Invalid lead email click signature');
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as {
    leadId?: unknown;
    inquiryId?: unknown;
    destinationUrl?: unknown;
  };
  const leadId = normalizeText(parsed?.leadId);
  const inquiryId = Number(parsed?.inquiryId || 0);
  const destinationUrl = normalizeText(parsed?.destinationUrl);
  if (!leadId || !Number.isFinite(inquiryId) || inquiryId <= 0 || !destinationUrl) {
    throw new Error('Lead email click token is missing required data');
  }

  return { leadId, inquiryId, destinationUrl };
}

function buildMetaLeadThankYouTrackingUrl(input: {
  leadId: string;
  inquiryId: number;
  destinationUrl: string;
}): string {
  const token = createMetaLeadEmailClickToken(input);
  return `${getEnv().BASE_URL}/api/public/meta-ads/lead-email-click/${encodeURIComponent(token)}`;
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

async function getMetaLeadDeliveryState(leadId: string): Promise<MetaLeadDeliveryState> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
       CAST(notifications_sent_at AS CHAR) AS notifications_sent_at,
       CAST(applicant_email_sent_at AS CHAR) AS applicant_email_sent_at
     FROM ${META_LEADS_TABLE}
     WHERE meta_lead_id = ?
     LIMIT 1`,
    [leadId]
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] as Record<string, unknown> : null;
  return {
    notificationsSentAt: normalizeText(row?.notifications_sent_at),
    applicantEmailSentAt: normalizeText(row?.applicant_email_sent_at),
  };
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

async function assertMetaPublishAccess(): Promise<void> {
  const stored = await getStoredMetaTokenConfig();
  if (!stored) return;

  const granted = new Set(stored.grantedScopes.map((scope) => String(scope || '').trim().toLowerCase()).filter(Boolean));
  if (granted.size === 0) return;

  if (!granted.has('ads_management')) {
    throw new Error('Connected Meta OAuth token is missing ads_management. Reconnect Meta with campaign publishing permissions.');
  }
}

async function assertMetaPagePublishAccess(needsPageWrite: boolean): Promise<void> {
  if (!needsPageWrite) return;

  const stored = await getStoredMetaTokenConfig();
  if (!stored) return;

  const granted = new Set(stored.grantedScopes.map((scope) => String(scope || '').trim().toLowerCase()).filter(Boolean));
  if (granted.size === 0) return;

  if (!granted.has('pages_manage_ads')) {
    throw new Error('Connected Meta OAuth token is missing pages_manage_ads. Reconnect Meta before creating instant forms.');
  }
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

async function logMetaCampaignPublishAttempt(params: {
  adAccountId: string;
  requestedBy: number | null;
  input: MetaCampaignPublishInput;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<void> {
  await ensureMetaLeadTables();
  const pool = getPool();

  await pool.query(
    `INSERT INTO ${META_CAMPAIGN_PUBLISH_LOG_TABLE}
      (meta_campaign_id, campaign_name, objective, publish_status, effective_status, ad_account_id, requested_by, request_json, response_json, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizeText(params.result?.id),
      params.input.name.trim(),
      params.input.objective,
      (params.input.status || 'PAUSED').toUpperCase(),
      normalizeText(params.result?.effective_status),
      params.adAccountId,
      params.requestedBy,
      JSON.stringify(params.input),
      params.result ? JSON.stringify(params.result) : null,
      params.errorMessage ?? null,
    ]
  );
}

function normalizeSpecialAdCategories(categories: MetaCampaignPublishInput['specialAdCategories']): Array<(typeof META_SPECIAL_AD_CATEGORIES)[number]> {
  const values = Array.isArray(categories) ? categories : [];
  const cleaned = Array.from(new Set(
    values
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  ));

  if (cleaned.length === 0) return [];
  if (cleaned.includes('NONE')) return ['NONE'];

  return cleaned.filter((value) => META_SPECIAL_AD_CATEGORIES.includes(value as (typeof META_SPECIAL_AD_CATEGORIES)[number])) as Array<(typeof META_SPECIAL_AD_CATEGORIES)[number]>;
}

function normalizeQuestionKeys(questionKeys: string[] | null | undefined): string[] {
  const cleaned = Array.from(new Set(
    (Array.isArray(questionKeys) ? questionKeys : ['FULL_NAME', 'EMAIL', 'PHONE'])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  ));

  return cleaned.length > 0 ? cleaned : ['FULL_NAME', 'EMAIL', 'PHONE'];
}

function validateMetaInstantFormPublishInput(input: MetaInstantFormPublishInput | null | undefined): NormalizedMetaInstantFormPublishInput | null {
  if (!input) return null;

  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error('Instant form name is required');
  }

  const privacyPolicyUrl = normalizeUrl(input.privacyPolicyUrl);
  if (!privacyPolicyUrl) {
    throw new Error('Instant form privacy policy URL must be a valid http or https URL');
  }

  const thankYouTitle = String(input.thankYouTitle || 'Thanks for your interest').trim() || 'Thanks for your interest';
  const thankYouBody = String(input.thankYouBody || 'We will contact you shortly.').trim() || 'We will contact you shortly.';

  return {
    name,
    privacyPolicyUrl,
    thankYouTitle,
    thankYouBody,
    followUpActionUrl: normalizeUrl(input.followUpActionUrl),
    questionKeys: normalizeQuestionKeys(input.questionKeys),
  };
}

function validateMetaAdCreativePublishInput(input: MetaAdCreativePublishInput | null | undefined): NormalizedMetaAdCreativePublishInput | null {
  if (!input) return null;

  const name = String(input.name || '').trim();
  if (!name) throw new Error('Ad creative name is required');

  const message = String(input.message || '').trim();
  if (!message) throw new Error('Ad creative primary text is required');

  const callToActionType = String(input.callToActionType || 'SIGN_UP').trim().toUpperCase();
  if (!META_CALL_TO_ACTION_TYPES.includes(callToActionType as (typeof META_CALL_TO_ACTION_TYPES)[number])) {
    throw new Error(`Unsupported call to action type: ${callToActionType}`);
  }

  const imageHash = normalizeText(input.imageHash);
  const imageUrl = normalizeUrl(input.imageUrl);
  if (!imageHash && !imageUrl) {
    throw new Error('Ad creative requires either an image hash or an image URL');
  }

  return {
    name,
    message,
    headline: normalizeText(input.headline),
    linkUrl: normalizeUrl(input.linkUrl),
    imageHash,
    imageUrl,
    callToActionType: callToActionType as (typeof META_CALL_TO_ACTION_TYPES)[number],
  };
}

function normalizeCountries(value: string[] | null | undefined): string[] {
  const cleaned = Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim().toUpperCase())
      .filter((item) => /^[A-Z]{2}$/.test(item))
  ));

  return cleaned;
}

function validateMetaAdSetPublishInput(input: MetaAdSetPublishInput | null | undefined): NormalizedMetaAdSetPublishInput | null {
  if (!input) return null;

  const name = String(input.name || '').trim();
  if (!name) throw new Error('Ad set name is required');

  const dailyBudget = Number(input.dailyBudget || 0);
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    throw new Error('Ad set daily budget must be a positive number');
  }

  const countries = normalizeCountries(input.countries);
  if (countries.length === 0) {
    throw new Error('Ad set targeting must include at least one two-letter country code');
  }

  const billingEvent = String(input.billingEvent || 'IMPRESSIONS').trim().toUpperCase();
  if (!META_BILLING_EVENTS.includes(billingEvent as (typeof META_BILLING_EVENTS)[number])) {
    throw new Error(`Unsupported billing event: ${billingEvent}`);
  }

  const optimizationGoal = String(input.optimizationGoal || 'QUALITY_LEAD').trim().toUpperCase();
  if (!META_OPTIMIZATION_GOALS.includes(optimizationGoal as (typeof META_OPTIMIZATION_GOALS)[number])) {
    throw new Error(`Unsupported optimization goal: ${optimizationGoal}`);
  }

  const destinationType = String(input.destinationType || 'ON_AD').trim().toUpperCase();
  if (!META_DESTINATION_TYPES.includes(destinationType as (typeof META_DESTINATION_TYPES)[number])) {
    throw new Error(`Unsupported destination type: ${destinationType}`);
  }

  const status = String(input.status || 'PAUSED').trim().toUpperCase();
  if (!META_DELIVERY_STATUSES.includes(status as (typeof META_DELIVERY_STATUSES)[number])) {
    throw new Error(`Unsupported ad set status: ${status}`);
  }

  return {
    name,
    dailyBudget,
    countries,
    billingEvent: billingEvent as (typeof META_BILLING_EVENTS)[number],
    optimizationGoal: optimizationGoal as (typeof META_OPTIMIZATION_GOALS)[number],
    destinationType: destinationType as (typeof META_DESTINATION_TYPES)[number],
    startTime: normalizeText(input.startTime),
    endTime: normalizeText(input.endTime),
    status: status as (typeof META_DELIVERY_STATUSES)[number],
  };
}

function validateMetaAdPublishInput(input: MetaAdPublishInput | null | undefined): NormalizedMetaAdPublishInput | null {
  if (!input) return null;

  const name = String(input.name || '').trim();
  if (!name) throw new Error('Ad name is required');

  const status = String(input.status || 'PAUSED').trim().toUpperCase();
  if (!META_DELIVERY_STATUSES.includes(status as (typeof META_DELIVERY_STATUSES)[number])) {
    throw new Error(`Unsupported ad status: ${status}`);
  }

  return {
    name,
    status: status as (typeof META_DELIVERY_STATUSES)[number],
  };
}

function validateMetaCampaignPublishInput(input: MetaCampaignPublishInput): NormalizedMetaCampaignPublishInput {
  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error('Campaign name is required');
  }

  if (!META_CAMPAIGN_OBJECTIVES.includes(input.objective)) {
    throw new Error(`Unsupported Meta campaign objective: ${String(input.objective || '')}`);
  }

  const status = String(input.status || 'PAUSED').trim().toUpperCase();
  if (!META_CAMPAIGN_STATUSES.includes(status as (typeof META_CAMPAIGN_STATUSES)[number])) {
    throw new Error(`Unsupported Meta campaign status: ${status}`);
  }

  const specialAdCategories = normalizeSpecialAdCategories(input.specialAdCategories);
  const pageId = normalizeText(input.pageId);
  const websiteUrl = normalizeUrl(input.websiteUrl);
  const instantForm = validateMetaInstantFormPublishInput(input.instantForm);
  const creative = validateMetaAdCreativePublishInput(input.creative);
  const adSet = validateMetaAdSetPublishInput(input.adSet);
  const ad = validateMetaAdPublishInput(input.ad);

  if ((instantForm || creative || adSet || ad) && !pageId) {
    throw new Error('Page ID is required when creating instant forms, creatives, ad sets, or ads');
  }

  if (ad && !adSet) {
    throw new Error('Ad creation requires an ad set configuration');
  }

  if (ad && !creative) {
    throw new Error('Ad creation requires a creative configuration');
  }

  if (creative && !websiteUrl && !instantForm?.followUpActionUrl && !creative.linkUrl) {
    throw new Error('Creative publishing requires a website URL, a creative link URL, or an instant form follow-up URL');
  }

  return {
    name,
    objective: input.objective,
    status: status as (typeof META_CAMPAIGN_STATUSES)[number],
    specialAdCategories,
    pageId,
    websiteUrl,
    instantForm,
    creative,
    adSet,
    ad,
  };
}

function buildLeadFormQuestions(questionKeys: string[]): Array<Record<string, unknown>> {
  return questionKeys.map((key) => ({ type: key }));
}

async function createMetaInstantForm(
  pageId: string,
  input: NormalizedMetaInstantFormPublishInput
): Promise<{ id: string; name: string }> {
  const result = await postGraphJson<MetaGraphCreateResponse>(
    `/${pageId}/leadgen_forms`,
    {
      name: input.name,
      locale: 'en_US',
      questions: buildLeadFormQuestions(input.questionKeys),
      privacy_policy: {
        url: input.privacyPolicyUrl,
        link_text: 'Privacy Policy',
      },
      thank_you_page: {
        title: input.thankYouTitle,
        body: input.thankYouBody,
        button_type: input.followUpActionUrl ? 'VIEW_WEBSITE' : 'NO_BUTTON',
        website_url: input.followUpActionUrl,
      },
      follow_up_action_url: input.followUpActionUrl,
    }
  );

  const id = normalizeText(result.id);
  if (!id) throw new Error('Meta instant form creation succeeded but no form id was returned');
  return { id, name: input.name };
}

async function createMetaAdCreative(params: {
  adAccountId: string;
  pageId: string;
  websiteUrl: string | null;
  input: NormalizedMetaAdCreativePublishInput;
  instantFormId: string | null;
}): Promise<{ id: string; name: string }> {
  const linkUrl = params.input.linkUrl || params.websiteUrl || `https://facebook.com/${params.pageId}`;
  const callToActionValue = params.instantFormId
    ? { lead_gen_form_id: params.instantFormId }
    : { link: linkUrl };

  const linkData: Record<string, unknown> = {
    message: params.input.message,
    link: linkUrl,
    call_to_action: {
      type: params.input.callToActionType,
      value: callToActionValue,
    },
  };

  if (params.input.headline) linkData.name = params.input.headline;
  if (params.input.imageHash) linkData.image_hash = params.input.imageHash;
  if (!params.input.imageHash && params.input.imageUrl) linkData.picture = params.input.imageUrl;

  const result = await postGraphJson<MetaGraphCreateResponse>(
    `/act_${params.adAccountId}/adcreatives`,
    {
      name: params.input.name,
      object_story_spec: {
        page_id: params.pageId,
        link_data: linkData,
      },
    }
  );

  const id = normalizeText(result.id);
  if (!id) throw new Error('Meta ad creative creation succeeded but no creative id was returned');
  return { id, name: params.input.name };
}

async function createMetaAdSet(params: {
  adAccountId: string;
  campaignId: string;
  pageId: string;
  input: NormalizedMetaAdSetPublishInput;
}): Promise<{ id: string; name: string }> {
  const targeting = {
    geo_locations: { countries: params.input.countries },
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream'],
  };

  const payload: Record<string, unknown> = {
    name: params.input.name,
    campaign_id: params.campaignId,
    daily_budget: Math.round(params.input.dailyBudget),
    billing_event: params.input.billingEvent,
    optimization_goal: params.input.optimizationGoal,
    destination_type: params.input.destinationType,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting,
    promoted_object: {
      page_id: params.pageId,
    },
    status: params.input.status,
  };

  if (params.input.startTime) payload.start_time = params.input.startTime;
  if (params.input.endTime) payload.end_time = params.input.endTime;

  const result = await postGraphJson<MetaGraphCreateResponse>(`/act_${params.adAccountId}/adsets`, payload);
  const id = normalizeText(result.id);
  if (!id) throw new Error('Meta ad set creation succeeded but no ad set id was returned');
  return { id, name: params.input.name };
}

async function createMetaAd(params: {
  adAccountId: string;
  adSetId: string;
  creativeId: string;
  input: NormalizedMetaAdPublishInput;
}): Promise<{ id: string; name: string }> {
  const result = await postGraphJson<MetaGraphCreateResponse>(
    `/act_${params.adAccountId}/ads`,
    {
      name: params.input.name,
      adset_id: params.adSetId,
      creative: { creative_id: params.creativeId },
      status: params.input.status,
    }
  );

  const id = normalizeText(result.id);
  if (!id) throw new Error('Meta ad creation succeeded but no ad id was returned');
  return { id, name: params.input.name };
}

export async function publishMetaCampaign(
  input: MetaCampaignPublishInput,
  options: { requestedBy?: number | null } = {}
): Promise<MetaCampaignPublishResult> {
  await ensureMetaLeadTables();
  await assertMetaPublishAccess();

  const payload = validateMetaCampaignPublishInput(input);
  await assertMetaPagePublishAccess(Boolean(payload.instantForm));
  const adAccountId = getMetaAdAccountIdRequired();
  const created: MetaPublishPipelineIds = {
    instantFormId: null,
    creativeId: null,
    adSetId: null,
    adId: null,
  };
  let instantFormName: string | null = null;
  let creativeName: string | null = null;
  let adSetName: string | null = null;
  let adName: string | null = null;

  try {
    const result = await postGraphJson<{ id?: string; effective_status?: string }>(
      `/act_${adAccountId}/campaigns`,
      {
        name: payload.name,
        objective: payload.objective,
        status: payload.status,
        special_ad_categories: payload.specialAdCategories,
        buying_type: 'AUCTION',
      }
    );

    const campaignId = normalizeText(result?.id);
    if (!campaignId) {
      throw new Error('Meta campaign publish succeeded but no campaign id was returned');
    }

    if (payload.pageId && payload.instantForm) {
      const form = await createMetaInstantForm(payload.pageId, payload.instantForm);
      created.instantFormId = form.id;
      instantFormName = form.name;
    }

    if (payload.pageId && payload.creative) {
      const creative = await createMetaAdCreative({
        adAccountId,
        pageId: payload.pageId,
        websiteUrl: payload.websiteUrl,
        input: payload.creative,
        instantFormId: created.instantFormId,
      });
      created.creativeId = creative.id;
      creativeName = creative.name;
    }

    if (payload.pageId && payload.adSet) {
      const adSet = await createMetaAdSet({
        adAccountId,
        campaignId,
        pageId: payload.pageId,
        input: payload.adSet,
      });
      created.adSetId = adSet.id;
      adSetName = adSet.name;
    }

    if (payload.ad && created.adSetId && created.creativeId) {
      const ad = await createMetaAd({
        adAccountId,
        adSetId: created.adSetId,
        creativeId: created.creativeId,
        input: payload.ad,
      });
      created.adId = ad.id;
      adName = ad.name;
    }

    await logMetaCampaignPublishAttempt({
      adAccountId,
      requestedBy: options.requestedBy ?? null,
      input: payload,
      result: {
        ...result,
        instant_form_id: created.instantFormId,
        creative_id: created.creativeId,
        adset_id: created.adSetId,
        ad_id: created.adId,
      },
    });

    const createdParts = [
      campaignId ? `campaign ${campaignId}` : null,
      created.instantFormId ? `form ${created.instantFormId}` : null,
      created.creativeId ? `creative ${created.creativeId}` : null,
      created.adSetId ? `ad set ${created.adSetId}` : null,
      created.adId ? `ad ${created.adId}` : null,
    ].filter(Boolean);

    return {
      campaignId,
      campaignName: payload.name,
      objective: payload.objective,
      status: payload.status,
      effectiveStatus: normalizeText(result?.effective_status) || payload.status,
      specialAdCategories: payload.specialAdCategories,
      adAccountId,
      pageId: payload.pageId,
      instantFormId: created.instantFormId,
      instantFormName,
      creativeId: created.creativeId,
      creativeName,
      adSetId: created.adSetId,
      adSetName,
      adId: created.adId,
      adName,
      message: createdParts.length > 1
        ? `Meta publish complete: ${createdParts.join(', ')}.`
        : 'Meta campaign created.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish Meta campaign';
    await logMetaCampaignPublishAttempt({
      adAccountId,
      requestedBy: options.requestedBy ?? null,
      input: payload,
      errorMessage: message,
    });
    throw error;
  }
}

export async function listMetaCampaignPublishLog(limit = 10): Promise<MetaCampaignPublishLogRow[]> {
  await ensureMetaLeadTables();
  const pool = getPool();
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const [rows] = await pool.query(
    `SELECT
       id,
       meta_campaign_id AS campaignId,
       campaign_name AS campaignName,
       objective,
       publish_status AS publishStatus,
       requested_by AS requestedBy,
       created_at AS createdAt,
       error_message AS errorMessage
     FROM ${META_CAMPAIGN_PUBLISH_LOG_TABLE}
     ORDER BY id DESC
     LIMIT ?`,
    [safeLimit]
  );

  return (rows as any[]).map((row) => ({
    id: Number(row.id),
    campaignId: normalizeText(row.campaignId),
    campaignName: String(row.campaignName || ''),
    objective: String(row.objective || ''),
    publishStatus: String(row.publishStatus || ''),
    requestedBy: row.requestedBy == null ? null : Number(row.requestedBy),
    createdAt: String(row.createdAt || ''),
    errorMessage: normalizeText(row.errorMessage),
  }));
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

function normalizeNameForDuplicateCheck(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesLikelySame(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeNameForDuplicateCheck(a);
  const nb = normalizeNameForDuplicateCheck(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  return ta[0] === tb[0];
}

async function findDuplicateInquiry(
  mobile: string | null,
  email: string | null,
  options: DuplicateMatchOptions = {}
): Promise<DuplicateMatch | null> {
  if (!mobile && !email) return null;

  const duplicateMatchConditions: string[] = [];
  const params: any[] = [];

  if (mobile) {
    duplicateMatchConditions.push(`RIGHT(REGEXP_REPLACE(COALESCE(si.Present_Mobile,''), '[^0-9]', ''), 10) = ?`);
    params.push(mobile);
  }
  if (email) {
    duplicateMatchConditions.push(`LOWER(TRIM(COALESCE(si.Email,''))) = ?`);
    params.push(email);
  }

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const [rows] = await pool.query(
    `SELECT
       si.Inquiry_Id as inquiryId,
       si.Student_Name as studentName,
       si.Present_Mobile as presentMobile,
       si.Email as email,
       CAST(NULLIF(si.Course_Id,'') AS UNSIGNED) as courseId
     FROM \`${inquiryTable}\` si
     WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
       AND (${duplicateMatchConditions.join(' OR ')})
     ORDER BY si.Inquiry_Id DESC
     LIMIT 20`,
    params
  );

  const candidates = (rows as any[])
    .map((row) => {
      const candidateMobile = normalizeDigits(row.presentMobile);
      const candidateEmail = normalizeEmail(row.email);
      const mobileMatch = Boolean(mobile && candidateMobile && mobile === candidateMobile);
      const emailMatch = Boolean(email && candidateEmail && email === candidateEmail);
      const nameMatch = namesLikelySame(options.studentName, normalizeText(row.studentName));
      return {
        inquiryId: Number(row.inquiryId),
        studentName: normalizeText(row.studentName),
        presentMobile: normalizeText(row.presentMobile),
        email: normalizeText(row.email),
        courseId: parseNumber(row.courseId),
        mobileMatch,
        emailMatch,
        nameMatch,
      };
    })
    .filter((c) => Number.isFinite(c.inquiryId) && c.inquiryId > 0);

  if (candidates.length === 0) return null;

  const requireStrong = Boolean(options.preferStrongMatch && mobile && email);
  const selected = candidates.find((c) => {
    if (requireStrong) {
      // Manual convert: if both identifiers are available, only accept both-match rows.
      if (!(c.mobileMatch && c.emailMatch)) return false;
      return c.nameMatch || !options.studentName;
    }

    // If only one identifier is present, avoid cross-person merges unless name also matches.
    const identifierMatched = c.mobileMatch || c.emailMatch;
    if (!identifierMatched) return false;
    if ((mobile && !email) || (email && !mobile)) {
      return c.nameMatch || !options.studentName;
    }
    return true;
  });

  if (!selected) return null;
  return {
    inquiryId: selected.inquiryId,
    studentName: selected.studentName,
    presentMobile: selected.presentMobile,
    email: selected.email,
    courseId: selected.courseId,
  };
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

function isAutoMetaSyncDiscussion(value: string | null | undefined): boolean {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return (
    text.includes('synced')
    && (text.includes('campaign:') || text.includes('campaign id:'))
    && (text.includes('form:') || text.includes('form id:'))
  );
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
  applicantEmailSentAt?: Date | null;
  applicantEmailLastError?: string | null;
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
       duplicate_reason, last_error, notifications_sent_at,
       applicant_email_sent_at, applicant_email_last_error
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
       notifications_sent_at = COALESCE(VALUES(notifications_sent_at), notifications_sent_at),
       applicant_email_sent_at = COALESCE(VALUES(applicant_email_sent_at), applicant_email_sent_at),
       applicant_email_last_error = CASE
         WHEN VALUES(applicant_email_sent_at) IS NOT NULL THEN NULL
         ELSE COALESCE(VALUES(applicant_email_last_error), applicant_email_last_error)
       END`,
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
      params.applicantEmailSentAt ?? null,
      params.applicantEmailLastError ?? null,
    ]
  );
}

export async function logMetaLeadEmailClick(input: {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}): Promise<string> {
  const parsed = parseMetaLeadEmailClickToken(input.token);
  try {
    await ensureMetaLeadTables();
    const pool = getPool();
    await pool.query(
      `INSERT INTO ${META_LEAD_EMAIL_CLICK_LOG_TABLE} (
         meta_lead_id,
         inquiry_id,
         destination_url,
         ip_address,
         user_agent,
         referer
       ) VALUES (?,?,?,?,?,?)`,
      [
        parsed.leadId,
        parsed.inquiryId,
        parsed.destinationUrl,
        normalizeText(input.ipAddress),
        normalizeText(input.userAgent),
        normalizeText(input.referer),
      ]
    );
  } catch (error) {
    console.error('Meta lead email click logging error:', error);
  }
  return parsed.destinationUrl;
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
  const qualification = firstValue(fields, ['educational_qualification', 'qualification_', 'what_is_your_qualification_', 'qualification', 'highest_qualification', 'education_level', 'education']);
  const discipline = firstValue(fields, ['discipline', 'stream']);
  const percentage = parseNumber(firstValue(fields, ['percentage', 'marks_percentage']));
  const inquiryDate = normalizeDateOnly(lead.created_time || event.created_time) || new Date().toISOString().slice(0, 10);
  const courseId = await resolveCourseId(courseName);
  const sourceInfo = resolveMetaLeadSource({ rawPayload, event, fields, ctx });
  const tags = Array.from(new Set([...buildTags(fields, ctx), sourceInfo.sourceTag])).sort();
  const utm = Object.fromEntries(Object.entries(fields).filter(([key]) => key.startsWith('utm_')));

  const duplicate = await findDuplicateInquiry(mobile, email, {
    studentName,
    preferStrongMatch: true,
  });

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
      Status_id: 1,
    };
    inquiryId = await createInquiry(createPayload);
    created = true;
  }

  const deliveryState = await getMetaLeadDeliveryState(leadId);

  let notified = Boolean(deliveryState.notificationsSentAt);
  if (!notified) {
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
  }

  let applicantEmailSentAt = deliveryState.applicantEmailSentAt ? new Date(deliveryState.applicantEmailSentAt) : null;
  let applicantEmailLastError: string | null = null;
  if (email && !applicantEmailSentAt) {
    const destinationUrl = getMetaLeadThankYouDestinationUrl();
    const trackingUrl = buildMetaLeadThankYouTrackingUrl({
      leadId,
      inquiryId,
      destinationUrl,
    });

    try {
      await sendMetaLeadThankYouEmail({
        toEmail: email,
        studentName,
        trackingUrl,
        websiteUrl: destinationUrl,
        logoUrl: `${getEnv().BASE_URL}/sit.png`,
        courseName,
        campaignName: ctx.campaignName,
      });
      applicantEmailSentAt = new Date();
    } catch (error) {
      applicantEmailLastError = error instanceof Error ? error.message : 'Failed to send Meta lead thank-you email';
      console.error('Meta lead applicant email error:', error);
    }
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
    applicantEmailSentAt,
    applicantEmailLastError,
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
  const cacheKey = `meta:perf:${params.dateFrom ?? ''}:${params.dateTo ?? ''}`;
  return cached(cacheKey, 300, async () => {
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
  const pool = getPool();
  // Run table setup and inquiry-table name resolution concurrently.
  const [inquiryTable] = await Promise.all([
    resolveInquiryTableName(pool),
    ensureMetaLeadTables(),
  ]);
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

  const conditions: string[] = ['1=1'];
  const queryParams: any[] = [];

  if (search) {
    conditions.push(`(
      LOWER(COALESCE(m.student_name,'')) LIKE ?
      OR LOWER(COALESCE(m.mobile,'')) LIKE ?
      OR LOWER(COALESCE(m.email,'')) LIKE ?
      OR CAST(COALESCE(m.inquiry_id, 0) AS CHAR) LIKE ?
      OR LOWER(COALESCE(m.course_name,'')) LIKE ?
      OR LOWER(COALESCE(m.campaign_name,'')) LIKE ?
      OR LOWER(COALESCE(m.form_name,'')) LIKE ?
    )`);
    const like = `%${search.toLowerCase()}%`;
    queryParams.push(like, like, like, like, like, like, like);
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
    const normalizedSource = source.toLowerCase().trim();
    if (normalizedSource.includes('instagram') || normalizedSource.includes('insta')) {
      conditions.push(`(
        LOWER(COALESCE(m.source_label,'')) LIKE ?
        OR LOWER(COALESCE(m.contact_source,'')) LIKE ?
        OR LOWER(COALESCE(m.tags_json,'')) LIKE ?
        OR LOWER(COALESCE(m.campaign_name,'')) LIKE ?
        OR LOWER(COALESCE(m.form_name,'')) LIKE ?
      )`);
      queryParams.push('%instagram%', '%instagram%', '%source:instagram%', '%instagram%', '%instagram%');
    } else if (normalizedSource.includes('facebook') || normalizedSource === 'fb') {
      conditions.push(`(
        LOWER(COALESCE(m.source_label,'')) LIKE ?
        OR LOWER(COALESCE(m.contact_source,'')) LIKE ?
        OR LOWER(COALESCE(m.tags_json,'')) LIKE ?
        OR LOWER(COALESCE(m.campaign_name,'')) LIKE ?
        OR LOWER(COALESCE(m.form_name,'')) LIKE ?
      )`);
      queryParams.push('%facebook%', '%facebook%', '%source:facebook%', '%facebook%', '%facebook%');
    } else {
      conditions.push(`LOWER(COALESCE(m.source_label,'')) LIKE ?`);
      queryParams.push(`%${normalizedSource}%`);
    }
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
    conditions.push(`LOWER(COALESCE(m.course_name,'')) LIKE ?`);
    queryParams.push(`%${training.toLowerCase()}%`);
  }
  if (duplicatesOnly) {
    conditions.push(`m.duplicate_of_inquiry_id IS NOT NULL`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  // Run count, main data, and filter-option queries in parallel.
  const [
    [countRowsRaw],
    [rowsRaw],
    [trainingRowsRaw],
    [sourceRowsRaw],
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
       FROM ${META_LEADS_TABLE} m
       LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
       ${whereClause}`,
      queryParams
    ),
    pool.query(
      `SELECT
         m.meta_lead_id AS MetaLead_Id,
         COALESCE(m.inquiry_id, 0) AS Student_Id,
         COALESCE(CAST(si.Student_Id AS UNSIGNED), 0) AS StudentMaster_Id,
         COALESCE(NULLIF(TRIM(m.student_name),''), NULLIF(TRIM(si.Student_Name),''), 'Meta Lead') AS Student_Name,
         NULLIF(TRIM(m.course_name),'') AS TrainingProgramme,
         NULLIF(TRIM(si.Qualification),'') AS InquiryQualification,
         COALESCE(NULLIF(TRIM(m.lead_created_time),''), CAST(m.created_at AS CHAR)) AS Inquiry_Dt,
         NULLIF(TRIM(m.mobile),'') AS Present_Mobile,
         NULLIF(TRIM(m.email),'') AS Email,
         m.contact_source AS Inquiry_From,
         m.source_label AS Inquiry_Type,
         COALESCE(CAST(NULLIF(si.OnlineState,'') AS UNSIGNED), m.online_state) AS Status_id,
         si.Discussion AS Discussion,
         COALESCE(NULLIF(TRIM(m.campaign_name),''), NULLIF(TRIM(m.campaign_id),'')) AS MetaCampaignName,
         NULLIF(TRIM(m.form_name),'') AS MetaFormName,
         m.tags_json AS LeadTagsJson,
         m.fields_json AS FieldsJson,
         m.duplicate_of_inquiry_id IS NOT NULL AS IsDuplicateLead,
         CAST(m.applicant_email_sent_at AS CHAR) AS ApplicantEmailSentAt
       FROM ${META_LEADS_TABLE} m
       LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
       ${whereClause}
       ORDER BY COALESCE(NULLIF(m.lead_created_time,''), CAST(m.created_at AS CHAR)) DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ),
    pool.query(
      `SELECT DISTINCT course_name
       FROM ${META_LEADS_TABLE}
       WHERE course_name IS NOT NULL AND TRIM(course_name) != ''
       ORDER BY course_name`
    ),
    pool.query(
      `SELECT DISTINCT source_label
       FROM ${META_LEADS_TABLE}
       WHERE source_label IS NOT NULL AND TRIM(source_label) != ''
       ORDER BY source_label`
    ),
  ]);

  let countRows = countRowsRaw as any[];
  let rows = rowsRaw as any[];
  const trainingRows = trainingRowsRaw as any[];
  const sourceRows = sourceRowsRaw as any[];
  let total = Number(countRows[0]?.total || 0);

  const normalizedSource = source.toLowerCase().trim();
  const platformFilterSelected =
    normalizedSource.includes('instagram')
    || normalizedSource.includes('insta')
    || normalizedSource.includes('facebook')
    || normalizedSource === 'fb';

  if (total === 0 && platformFilterSelected) {
    try {
      await backfillStoredMetaLeadSources();
      await syncLiveMetaLeadsToDb();

      const [[retryCountRows], [retryRows]] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS total
           FROM ${META_LEADS_TABLE} m
           LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
           ${whereClause}`,
          queryParams
        ),
        pool.query(
          `SELECT
             m.meta_lead_id AS MetaLead_Id,
             COALESCE(m.inquiry_id, 0) AS Student_Id,
             COALESCE(CAST(si.Student_Id AS UNSIGNED), 0) AS StudentMaster_Id,
             COALESCE(NULLIF(TRIM(m.student_name),''), NULLIF(TRIM(si.Student_Name),''), 'Meta Lead') AS Student_Name,
             NULLIF(TRIM(m.course_name),'') AS CourseName,
             NULLIF(TRIM(si.Qualification),'') AS InquiryQualification,
             COALESCE(NULLIF(TRIM(m.lead_created_time),''), CAST(m.created_at AS CHAR)) AS Inquiry_Dt,
             NULLIF(TRIM(m.mobile),'') AS Present_Mobile,
             NULLIF(TRIM(m.email),'') AS Email,
             m.contact_source AS Inquiry_From,
             m.source_label AS Inquiry_Type,
             COALESCE(CAST(NULLIF(si.OnlineState,'') AS UNSIGNED), m.online_state) AS Status_id,
             si.Discussion AS Discussion,
             COALESCE(NULLIF(TRIM(m.campaign_name),''), NULLIF(TRIM(m.campaign_id),'')) AS MetaCampaignName,
             NULLIF(TRIM(m.form_name),'') AS MetaFormName,
             m.tags_json AS LeadTagsJson,
             m.fields_json AS FieldsJson,
             m.duplicate_of_inquiry_id IS NOT NULL AS IsDuplicateLead,
             CAST(m.applicant_email_sent_at AS CHAR) AS ApplicantEmailSentAt
           FROM ${META_LEADS_TABLE} m
           LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
           ${whereClause}
           ORDER BY COALESCE(NULLIF(m.lead_created_time,''), CAST(m.created_at AS CHAR)) DESC, m.id DESC
           LIMIT ? OFFSET ?`,
          [...queryParams, limit, offset]
        ),
      ]);

      countRows = retryCountRows as any[];
      rows = retryRows as any[];
      total = Number(countRows[0]?.total || 0);
    } catch {
      // Best-effort recovery for stale platform labels/sync; keep current empty result on failure.
    }
  }

  // Backfill and live-sync are maintenance tasks — run them in the background
  // so they never block the response.
  if (total === 0) {
    // First-time load: kick off a background sync so the next request has data.
    Promise.resolve().then(() => syncLiveMetaLeadsToDb()).catch(() => {});
  } else {
    // Schedule source backfill and incremental sync without awaiting.
    Promise.resolve().then(async () => {
      const [[coverage]] = await pool.query(
        `SELECT
           SUM(CASE WHEN LOWER(COALESCE(NULLIF(TRIM(source_label), ''), ?)) <> LOWER(?) THEN 1 ELSE 0 END) AS classified
         FROM ${META_LEADS_TABLE}`,
        [META_SOURCE_LABEL, META_SOURCE_LABEL]
      ) as any;
      if (Number(coverage?.classified || 0) === 0) {
        await backfillStoredMetaLeadSources();
      }

      const [[incomplete]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM ${META_LEADS_TABLE}
         WHERE COALESCE(NULLIF(TRIM(campaign_name), ''), NULLIF(TRIM(course_name), '')) IS NULL`
      ) as any;
      if (Number(incomplete?.total || 0) > 0) {
        await syncLiveMetaLeadsToDb();
      }
    }).catch(() => {});
  }

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

    let fields: Record<string, string | null> = {};
    try {
      const parsed = JSON.parse(row.FieldsJson || '{}');
      fields = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {}

    const city: string | null =
      (fields['city'] as string | null) ||
      (fields['location'] as string | null) ||
      tags.find((t) => t.startsWith('city:'))?.slice('city:'.length) ||
      tags.find((t) => t.startsWith('location:'))?.slice('location:'.length) ||
      null;

    const statusIdNum = row.Status_id == null ? null : Number(row.Status_id);
    const discussion = row.Discussion ?? null;
    const qualification =
      (row.InquiryQualification as string | null) ||
      (fields['educational_qualification'] as string | null) ||
      (fields['qualification_'] as string | null) ||
      (fields['what_is_your_qualification_'] as string | null) ||
      (fields['qualification'] as string | null) ||
      (fields['highest_qualification'] as string | null) ||
      (fields['education_level'] as string | null) ||
      (fields['education'] as string | null) ||
      null;

    return {
      MetaLead_Id: String(row.MetaLead_Id || ''),
      Student_Id: Number(row.Student_Id || 0),
      StudentMaster_Id: Number(row.StudentMaster_Id || 0),
      Student_Name: String(row.Student_Name || 'Meta Lead'),
      CourseName: qualification,
      TrainingProgramme: (row.TrainingProgramme as string | null) ?? null,
      Inquiry_Dt: row.Inquiry_Dt ?? null,
      Present_Mobile: row.Present_Mobile ?? null,
      Email: row.Email ?? null,
      Inquiry_From: row.Inquiry_From ?? null,
      Inquiry_Type: row.Inquiry_Type ?? null,
      Status_id: statusIdNum,
      StatusLabel: statusIdNum != null ? (FALLBACK_STATUSES[statusIdNum] || `Status ${statusIdNum}`) : 'Open',
      Discussion: isAutoMetaSyncDiscussion(discussion) ? null : discussion,
      MetaCampaignName: row.MetaCampaignName ?? null,
      MetaFormName: row.MetaFormName ?? null,
      LeadTags: tags,
      IsDuplicateLead: Boolean(row.IsDuplicateLead),
      ApplicantEmailSentAt: row.ApplicantEmailSentAt ?? null,
      City: city ? String(city).trim() || null : null,
      LeadFields: fields,
    };
  });

  return {
    rows: mappedRows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filters: {
      trainings: trainingRows.map((row: any) => String(row.course_name).trim()).filter(Boolean),
      sources: sourceRows.map((row: any) => String(row.source_label).trim()).filter(Boolean),
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
       COALESCE(CAST(si.Student_Id AS UNSIGNED), 0) AS StudentMaster_Id,
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
    StudentMaster_Id: Number(row.StudentMaster_Id || 0),
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
       inquiry_id,
       student_name,
       course_name,
       mobile,
       email,
       contact_source,
       source_label,
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

  const nextFields = { ...(input.fields ?? existingFields) };
  if (input.city !== undefined) {
    nextFields['city'] = input.city ? input.city.trim() || null : null;
  }
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
         tags_json = ?,
         online_state = ?
     WHERE meta_lead_id = ?`,
    [
      studentName,
      courseName,
      mobile,
      email,
      JSON.stringify(nextFields),
      JSON.stringify(nextUtm),
      JSON.stringify(tags),
      input.statusId !== undefined ? (input.statusId ?? null) : null,
      metaLeadId,
    ]
  );

  const linkedInquiryId = Number(row.inquiry_id || 0);
  if (Number.isFinite(linkedInquiryId) && linkedInquiryId > 0) {
    const inquiryTable = await resolveInquiryTableName(pool);
    const courseId = await resolveCourseId(courseName);
    const inquirySource = normalizeText(row.contact_source) || META_CONTACT_SOURCE;
    const inquiryType = normalizeText(row.source_label) || META_SOURCE_LABEL;

    const updates: string[] = [
      'si.Student_Name = ?',
      'si.Present_Mobile = ?',
      'si.Email = ?',
      'si.Inquiry_From = ?',
      'si.Inquiry_Type = ?',
      'si.Course_Id = ?',
    ];
    const updateParams: any[] = [
      studentName,
      mobile,
      email,
      inquirySource,
      inquiryType,
      courseId,
    ];

    if (input.statusId != null) {
      updates.push('si.OnlineState = ?');
      updateParams.push(String(input.statusId));
    }

    if (input.discussion !== undefined) {
      updates.push('si.Discussion = ?');
      updateParams.push(normalizeText(input.discussion));
    }

    updateParams.push(linkedInquiryId);

    await pool.query(
      `UPDATE \`${inquiryTable}\` si
       SET ${updates.join(', ')}
       WHERE si.Inquiry_Id = ?`,
      updateParams
    );
  }

  invalidateCache('api:inquiry');

  return getMetaLeadDetail(metaLeadId);
}

export async function convertMetaLeadToInquiry(metaLeadId: string): Promise<MetaLeadDetailResult | null> {
  await ensureMetaLeadTables();
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT
       meta_lead_id,
       inquiry_id,
       duplicate_of_inquiry_id,
       student_name,
       course_name,
       mobile,
       email,
       lead_created_time,
       contact_source,
       source_label,
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
       utm_json,
       tags_json
     FROM ${META_LEADS_TABLE}
     WHERE meta_lead_id = ?
     LIMIT 1`,
    [metaLeadId]
  );

  const row = (rows as any[])[0];
  if (!row) return null;
  if (Number(row.inquiry_id || 0) > 0) {
    const inquiryId = Number(row.inquiry_id || 0);
    const inquiryTable = await resolveInquiryTableName(pool);
    const [inquiryRows] = await pool.query(
      `SELECT Inquiry_Id, Student_Name, Present_Mobile, Email
       FROM \`${inquiryTable}\`
       WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       LIMIT 1`,
      [inquiryId]
    );

    if ((inquiryRows as any[]).length > 0) {
      const inquiry = (inquiryRows as any[])[0] ?? {};
      const linkedName = normalizeText(inquiry.Student_Name);
      const linkedMobile = normalizeDigits(inquiry.Present_Mobile);
      const linkedEmail = normalizeEmail(inquiry.Email);
      const leadName = normalizeText(row.student_name);
      const leadMobile = normalizeDigits(row.mobile);
      const leadEmail = normalizeEmail(row.email);

      const hasLeadIdentity = Boolean(leadName || leadMobile || leadEmail);
      const nameOk = namesLikelySame(leadName, linkedName);
      const mobileOk = Boolean(leadMobile && linkedMobile && leadMobile === linkedMobile);
      const emailOk = Boolean(leadEmail && linkedEmail && leadEmail === linkedEmail);

      // Keep existing link only when it looks like the same person.
      if (!hasLeadIdentity || nameOk || mobileOk || emailOk) {
        return getMetaLeadDetail(metaLeadId);
      }
    }

    await pool.query(
      `UPDATE ${META_LEADS_TABLE}
       SET inquiry_id = NULL,
           duplicate_of_inquiry_id = NULL
       WHERE meta_lead_id = ?`,
      [metaLeadId]
    );
  }

  let fields: Record<string, string | null> = {};
  let utm: Record<string, string | null> = {};
  let tags: string[] = [];

  try {
    const parsed = JSON.parse(row.fields_json || '{}');
    fields = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  try {
    const parsed = JSON.parse(row.utm_json || '{}');
    utm = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {}

  try {
    const parsed = JSON.parse(row.tags_json || '[]');
    tags = Array.isArray(parsed) ? parsed.map((tag) => String(tag)).filter(Boolean) : [];
  } catch {}

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

  const fallbackName = [firstValue(fields, ['first_name']), firstValue(fields, ['last_name'])]
    .filter(Boolean)
    .join(' ')
    .trim();

  const sourceLabel = normalizeText(row.source_label) || META_SOURCE_LABEL;
  const contactSource = normalizeText(row.contact_source) || META_CONTACT_SOURCE;
  const studentName = normalizeText(row.student_name)
    ?? firstValue(fields, ['full_name', 'full_name_1', 'name'])
    ?? (fallbackName || null)
    ?? 'Meta Lead';
  const courseName = normalizeText(row.course_name) ?? resolveMetaCourseName(fields, ctx.formName);
  const mobile = normalizeDigits(row.mobile)
    ?? normalizeDigits(firstValue(fields, ['phone_number', 'phone', 'mobile', 'whatsapp_number', 'whatsapp']));
  const email = normalizeEmail(row.email)
    ?? normalizeEmail(firstValue(fields, ['email', 'email_address']));
  const qualification = firstValue(fields, ['educational_qualification', 'qualification_', 'what_is_your_qualification_', 'qualification', 'highest_qualification', 'education_level', 'education']);
  const discipline = firstValue(fields, ['discipline', 'stream']);
  const percentage = parseNumber(firstValue(fields, ['percentage', 'marks_percentage']));
  const inquiryDate = normalizeDateOnly(row.lead_created_time) || new Date().toISOString().slice(0, 10);
  const courseId = await resolveCourseId(courseName);
  const nextTags = Array.from(new Set(tags)).sort();
  const duplicate = await findDuplicateInquiry(mobile, email);

  let inquiryId: number;
  let duplicateReason: string | null = null;

  if (duplicate) {
    inquiryId = duplicate.inquiryId;
    duplicateReason = mobile && email
      ? 'Matched existing inquiry by mobile or email during manual conversion'
      : mobile
        ? 'Matched existing inquiry by mobile during manual conversion'
        : 'Matched existing inquiry by email during manual conversion';

    await updateInquiry(inquiryId, {
      Student_Name: studentName || duplicate.studentName || 'Meta Lead',
      Present_Mobile: mobile || duplicate.presentMobile,
      Email: email || duplicate.email,
      Inquiry_Dt: inquiryDate,
      Inquiry_From: contactSource,
      Inquiry_Type: sourceLabel,
      Course_Id: courseId || duplicate.courseId,
      Qualification: qualification,
      Discipline: discipline,
      Percentage: percentage != null ? String(percentage) : null,
    });
  } else {
    inquiryId = await createInquiry({
      Student_Name: studentName,
      Present_Mobile: mobile,
      Email: email,
      Inquiry_Dt: inquiryDate,
      Inquiry_From: contactSource,
      Inquiry_Type: sourceLabel,
      Course_Id: courseId,
      Qualification: qualification,
      Discipline: discipline,
      Percentage: percentage != null ? String(percentage) : null,
      Status_id: 1,
    });
  }

  await pool.query(
    `UPDATE ${META_LEADS_TABLE}
     SET inquiry_id = ?,
         duplicate_of_inquiry_id = ?,
         student_name = ?,
         course_name = ?,
         mobile = ?,
         email = ?,
         contact_source = ?,
         source_label = ?,
         fields_json = ?,
         utm_json = ?,
         tags_json = ?,
         duplicate_reason = ?
     WHERE meta_lead_id = ?`,
    [
      inquiryId,
      duplicate?.inquiryId ?? null,
      studentName,
      courseName,
      mobile,
      email,
      contactSource,
      sourceLabel,
      JSON.stringify(fields),
      JSON.stringify(utm),
      JSON.stringify(nextTags),
      duplicateReason,
      metaLeadId,
    ]
  );

  // Keep inquiry list/edit endpoints in sync immediately after conversion.
  invalidateCache('api:inquiry');

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
  const inquiryTable = await resolveInquiryTableName(pool);
  const hasStudentIdColumn = await hasTableColumn(pool, 'awt_inquirydiscussion', 'student_id');
  const hasNextDateColumn = await hasTableColumn(pool, 'awt_inquirydiscussion', 'nextdate');
  const nextDateSelect = hasNextDateColumn ? 'd.nextdate AS nextDate' : 'NULL AS nextDate';
  const canonicalInquiryByStudentIdSubquery = `
    SELECT si2.Inquiry_Id
    FROM \`${inquiryTable}\` si2
    WHERE si2.Student_Id = m.inquiry_id
    ORDER BY si2.Inquiry_Id DESC
    LIMIT 1
  `;
  const studentJoin = hasStudentIdColumn
    ? 'OR (d.student_id IS NOT NULL AND (d.student_id = si.Student_Id OR d.student_id = m.inquiry_id))'
    : '';
  const [rows] = await pool.query(
    `SELECT d.id, d.date, ${nextDateSelect}, d.discussion AS note, d.created_date AS createdAt
     FROM ${META_LEADS_TABLE} m
     LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
     INNER JOIN awt_inquirydiscussion d ON (
       d.Inquiry_id = m.inquiry_id
       OR d.Inquiry_id = (${canonicalInquiryByStudentIdSubquery})
       ${studentJoin}
     )
     WHERE m.meta_lead_id = ?
       AND (d.deleted = 0 OR d.deleted IS NULL)
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
  let [leadRows] = await pool.query(
    `SELECT inquiry_id FROM ${META_LEADS_TABLE} WHERE meta_lead_id = ? LIMIT 1`,
    [metaLeadId]
  );
  let lead = (leadRows as any[])[0];

  // Some Meta leads are not linked to a local inquiry until manual conversion.
  // Auto-convert on first follow-up attempt so notes are always persisted.
  if (!lead?.inquiry_id) {
    await convertMetaLeadToInquiry(metaLeadId);
    [leadRows] = await pool.query(
      `SELECT inquiry_id FROM ${META_LEADS_TABLE} WHERE meta_lead_id = ? LIMIT 1`,
      [metaLeadId]
    );
    lead = (leadRows as any[])[0];
  }

  if (!lead?.inquiry_id) {
    throw new Error('Unable to link this Meta lead to an inquiry. Please convert the lead and try again.');
  }

  const inquiryTable = await resolveInquiryTableName(pool);
  const [inquiryRows] = await pool.query(
    `SELECT Inquiry_Id, Student_Id
     FROM \`${inquiryTable}\`
     WHERE Inquiry_Id = ? OR Student_Id = ?
     ORDER BY Inquiry_Id DESC
     LIMIT 1`,
    [lead.inquiry_id, lead.inquiry_id]
  );
  const inquiry = (inquiryRows as any[])[0] || {};
  const canonicalInquiryId = Number(inquiry.Inquiry_Id || lead.inquiry_id);
  const canonicalStudentId = inquiry.Student_Id == null ? null : Number(inquiry.Student_Id);

  const hasStudentIdColumn = await hasTableColumn(pool, 'awt_inquirydiscussion', 'student_id');
  const hasNextDateColumn = await hasTableColumn(pool, 'awt_inquirydiscussion', 'nextdate');
  const safeNext = nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate) ? nextDate : null;

  if (hasStudentIdColumn && hasNextDateColumn) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, student_id, date, nextdate, discussion, deleted, created_by, created_date)
       VALUES (?, ?, CURDATE(), ?, ?, 0, 1, NOW())`,
      [canonicalInquiryId, canonicalStudentId, safeNext, note.trim()]
    );
  } else if (hasStudentIdColumn) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, student_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, ?, CURDATE(), ?, 0, 1, NOW())`,
      [canonicalInquiryId, canonicalStudentId, note.trim()]
    );
  } else if (hasNextDateColumn) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, nextdate, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, ?, 0, 1, NOW())`,
      [canonicalInquiryId, safeNext, note.trim()]
    );
  } else {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [canonicalInquiryId, note.trim()]
    );
  }

  await pool.query(
    `UPDATE \`${inquiryTable}\`
     SET Discussion = ?
     WHERE Inquiry_Id = ?`,
    [note.trim(), canonicalInquiryId]
  );
}
