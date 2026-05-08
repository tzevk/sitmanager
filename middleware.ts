/**
 * Next.js Edge Middleware
 *
 * Runs on the Edge Runtime (closest to the user) — no MySQL, no ioredis.
 * Validates the JWT session cookie and rejects unauthenticated requests
 * before they reach any serverless function.
 *
 * Benefit: cold-start cost + DB connections are never paid for 401 traffic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'sit_session';

// Routes that do NOT require authentication
const PUBLIC_PREFIXES = [
  '/api/auth/',          // login / logout
  '/api/public/',        // public-facing forms
  '/api/health/',        // uptime checks
  '/api/online-admission/', // public student intake
  '/api/colleges-by-city',  // public dropdown
  '/api/search-universities', // public dropdown
  '/api/cron/',          // cron jobs use their own bearer token
  '/company/',           // public JD submission
  '/public/',            // public feedback / inquiry pages
  '/signin',             // login page
  '/student-portal/signin',
  '/trainer-portal/signin',
  '/_next/',             // Next.js internals
  '/favicon',
];

// Routes that require authentication (checked after PUBLIC_PREFIXES)
const PROTECTED_PREFIXES = [
  '/api/',
  '/dashboard/',
  '/student-portal/dashboard',
  '/trainer-portal/dashboard',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip public routes immediately
  if (isPublic(pathname)) return NextResponse.next();

  // Only enforce auth on protected prefixes
  if (!isProtected(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return rejectRequest(request, pathname);
  }

  try {
    await jwtVerify(token, getSecretKey());
    return NextResponse.next();
  } catch {
    // Token expired or tampered — clear the stale cookie
    const response = rejectRequest(request, pathname);
    response.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
    return response;
  }
}

function rejectRequest(request: NextRequest, pathname: string): NextResponse {
  // API routes → 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please login to continue' },
      { status: 401 }
    );
  }
  // Page routes → redirect to sign-in
  const loginUrl = request.nextUrl.clone();
  if (pathname.startsWith('/student-portal/')) {
    loginUrl.pathname = '/student-portal/signin';
  } else if (pathname.startsWith('/trainer-portal/')) {
    loginUrl.pathname = '/trainer-portal/signin';
  } else {
    loginUrl.pathname = '/signin';
  }
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals.
     * The middleware function itself decides whether to enforce auth.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
