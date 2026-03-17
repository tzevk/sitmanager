import { NextResponse } from 'next/server';

const STUDENT_COOKIE = 'sit_student_session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(STUDENT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
