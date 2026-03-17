import { NextResponse } from 'next/server';

const TRAINER_COOKIE = 'sit_trainer_session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(TRAINER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
