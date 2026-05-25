import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { buildMetaOAuthAuthorizeUrl } from '@/lib/services/meta-ads.service';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, ['inquiry.view', 'inquiry.update']);
  if (auth instanceof NextResponse) return auth;

  const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/dashboard/meta-leads';
  const callbackUrl = new URL('/api/meta-ads/oauth/callback', req.nextUrl.origin).toString();
  const authUrl = buildMetaOAuthAuthorizeUrl(callbackUrl, redirectTo);
  return NextResponse.redirect(authUrl);
}