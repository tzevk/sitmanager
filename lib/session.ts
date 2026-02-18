import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// SECURITY: Never fall back to a default secret — fail hard if JWT_SECRET is missing
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'CRITICAL: JWT_SECRET environment variable is not set. ' +
      'The application cannot start without a secure signing key.'
    );
  }
  if (secret.length < 32) {
    throw new Error('CRITICAL: JWT_SECRET must be at least 32 characters long.');
  }
  return new TextEncoder().encode(secret);
}

// Lazy-initialized secret key — validated on first use
let _secretKey: Uint8Array | null = null;
function SECRET_KEY(): Uint8Array {
  if (!_secretKey) {
    _secretKey = getSecretKey();
  }
  return _secretKey;
}

const SESSION_COOKIE_NAME = 'sit_session';
const SESSION_DURATION = 60 * 60 * 8; // 8 hours in seconds (reduced from 24h)

export interface SessionData {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: number;
}

/**
 * Create a session token
 */
export async function createSession(data: SessionData): Promise<string> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET_KEY());
  
  return token;
}

/**
 * Verify and decode session token
 */
export async function verifySession(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY());
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

/**
 * Set session cookie in response
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });
}

/**
 * Get session from request
 */
export async function getSession(request: NextRequest): Promise<SessionData | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Get session from server component (using cookies())
 */
export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Check if request has valid session
 */
export async function requireAuth(request: NextRequest): Promise<SessionData | NextResponse> {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please login to continue' },
      { status: 401 }
    );
  }
  return session;
}
