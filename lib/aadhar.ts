/**
 * Aadhaar number helpers shared by the online admission form, the staff
 * review page and the server. Aadhaar is 12 digits, never starts with 0 or 1,
 * and its last digit is a Verhoeff checksum.
 */

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Digits only, or null when empty. */
export function normalizeAadhar(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

export function isValidAadhar(value: unknown): boolean {
  const digits = normalizeAadhar(value);
  if (!digits || !/^[2-9]\d{11}$/.test(digits)) return false;
  let c = 0;
  digits.split('').reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
  return c === 0;
}

/** "1234 5678 9012" for display. */
export function formatAadhar(value: unknown): string {
  const digits = normalizeAadhar(value) || '';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
