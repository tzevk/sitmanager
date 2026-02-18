/**
 * Input validation & sanitization utilities.
 *
 * Provides lightweight validation helpers without requiring a large
 * schema library (zod/joi). For complex forms, consider adding zod.
 */

// ── String sanitization ─────────────────────────────────────────────

/**
 * Trim and sanitize a string input. Returns empty string for non-strings.
 * Strips leading/trailing whitespace and null bytes.
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\0/g, '');
}

/**
 * Sanitize and enforce a max length on string input.
 */
export function sanitizeStringMax(value: unknown, maxLength: number): string {
  return sanitizeString(value).slice(0, maxLength);
}

// ── Type coercion ───────────────────────────────────────────────────

/**
 * Coerce a value to a positive integer, or return the default.
 */
export function toPositiveInt(value: unknown, defaultValue: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return defaultValue;
  return Math.floor(num);
}

/**
 * Coerce and clamp an integer within bounds.
 */
export function toClampedInt(value: unknown, min: number, max: number, defaultValue: number): number {
  const num = toPositiveInt(value, defaultValue);
  return Math.min(max, Math.max(min, num));
}

// ── Validation checks ───────────────────────────────────────────────

/**
 * Validate an email address format.
 */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // RFC 5322-ish pattern — good enough for form validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/**
 * Validate a phone number (digits, spaces, dashes, plus, parens).
 */
export function isValidPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[+\d\s\-()]{7,20}$/.test(value);
}

/**
 * Check that a required string field is non-empty after trimming.
 */
export function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a safe integer ID (positive, no injection risk).
 */
export function isValidId(value: unknown): value is number {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
}

// ── Batch validation ────────────────────────────────────────────────

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate multiple fields at once. Returns array of errors (empty = valid).
 *
 * @example
 * const errors = validateFields([
 *   [!isNonEmpty(name), 'name', 'Name is required'],
 *   [!isValidEmail(email), 'email', 'Invalid email format'],
 * ]);
 * if (errors.length > 0) {
 *   return NextResponse.json({ errors }, { status: 400 });
 * }
 */
export function validateFields(
  checks: [condition: boolean, field: string, message: string][]
): ValidationError[] {
  return checks
    .filter(([condition]) => condition)
    .map(([, field, message]) => ({ field, message }));
}
