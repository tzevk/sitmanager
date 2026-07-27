import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.STUDENT_PASSWORD_ENC_KEY;
  if (!hex) throw new Error('STUDENT_PASSWORD_ENC_KEY not configured');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('STUDENT_PASSWORD_ENC_KEY must be a 32-byte (64 hex character) key');
  }
  return key;
}

export function encryptPassword(plain: string): Buffer {
  const KEY = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Reverses encryptPassword: slices iv/authTag/ciphertext back out and decrypts.
 * Throws a clear error on failure (bad key, corrupt/truncated data, tampered ciphertext).
 */
export function decryptPassword(buf: Buffer): string {
  const KEY = getKey();
  if (!Buffer.isBuffer(buf) || buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted password data: too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (err) {
    throw new Error(
      `Failed to decrypt password (wrong key or corrupt data): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
