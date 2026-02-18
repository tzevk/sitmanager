/**
 * Next.js Proxy — runs on the Edge for every matched request.
 * Handles:
 *  1. Session check for /api/* (except auth routes) and /dashboard/*
 *  2. Redirects unauthenticated users to /signin
 *  3. Returns 401 for unauthenticated API requests
 *  4. Adds security headers to all responses
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// SECURITY: Never fall back to a default secret — fail hard if missing
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'CRITICAL: JWT_SECRET environment variable is missing or too short (min 32 chars).'
    );
  }
  return new TextEncoder().encode(secret);
}

let _secretKey: Uint8Array | null = null;
function SECRET_KEY(): Uint8Array {
  if (!_secretKey) _secretKey = getSecretKey();
  return _secretKey;
}

const SESSION_COOKIE = 'sit_session';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/signin',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/health',
];

// Prefixes that are always public (static assets, etc.)
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/static'];

// File extensions that should always be served publicly
const PUBLIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.css', '.js', '.woff', '.woff2', '.ttf'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  if (PUBLIC_EXTENSIONS.some(ext => pathname.endsWith(ext))) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Only protect /api/* and /dashboard/* routes
  const isApiRoute = pathname.startsWith('/api/');
  const isDashboardRoute = pathname.startsWith('/dashboard');

  if (!isApiRoute && !isDashboardRoute) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Check for session cookie
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please login to continue' },
        { status: 401 }
      );
    }
    // Redirect to signin for page requests
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Verify JWT token
  try {
    await jwtVerify(token, SECRET_KEY());
    return addSecurityHeaders(NextResponse.next());
  } catch {
    // Invalid/expired token — clear cookie and respond
    const response = isApiRoute
      ? NextResponse.json(
          { error: 'Session expired', message: 'Please login again' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/signin', request.url));

    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  }
}

/**
 * Append security headers to any response.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

// Configure which paths the proxy runs on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
