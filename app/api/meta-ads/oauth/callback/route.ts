import { NextRequest, NextResponse } from 'next/server';
import { exchangeMetaOAuthCode, verifyMetaOAuthState } from '@/lib/services/meta-ads.service';

function buildReturnUrl(req: NextRequest, redirectTo: string) {
  const safePath = redirectTo.startsWith('/') ? redirectTo : '/dashboard/meta-leads';
  return new URL(safePath, req.nextUrl.origin);
}

export async function GET(req: NextRequest) {
  const state = verifyMetaOAuthState(req.nextUrl.searchParams.get('state'));
  const returnUrl = buildReturnUrl(req, state.redirectTo);

  const metaError = req.nextUrl.searchParams.get('error_message')
    || req.nextUrl.searchParams.get('error_description')
    || req.nextUrl.searchParams.get('error');
  if (metaError) {
    returnUrl.searchParams.set('metaOAuth', 'error');
    returnUrl.searchParams.set('metaOAuthMessage', metaError);
    return NextResponse.redirect(returnUrl);
  }

  if (!state.ok) {
    returnUrl.searchParams.set('metaOAuth', 'error');
    returnUrl.searchParams.set('metaOAuthMessage', 'Invalid or expired OAuth state');
    return NextResponse.redirect(returnUrl);
  }

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    returnUrl.searchParams.set('metaOAuth', 'error');
    returnUrl.searchParams.set('metaOAuthMessage', 'Missing Meta authorization code');
    return NextResponse.redirect(returnUrl);
  }

  try {
    const callbackUrl = new URL('/api/meta-ads/oauth/callback', req.nextUrl.origin).toString();
    const result = await exchangeMetaOAuthCode(code, callbackUrl);
    returnUrl.searchParams.set('metaOAuth', 'connected');
    returnUrl.searchParams.set('metaOAuthPages', String(result.pages.length));
    if (result.userName) {
      returnUrl.searchParams.set('metaOAuthUser', result.userName);
    }
    return NextResponse.redirect(returnUrl);
  } catch (error: unknown) {
    returnUrl.searchParams.set('metaOAuth', 'error');
    returnUrl.searchParams.set(
      'metaOAuthMessage',
      error instanceof Error ? error.message : 'Meta OAuth connection failed'
    );
    return NextResponse.redirect(returnUrl);
  }
}