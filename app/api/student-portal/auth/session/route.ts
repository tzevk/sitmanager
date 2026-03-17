/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const STUDENT_COOKIE = 'sit_student_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export interface StudentSession {
  studentId: number;
  name: string;
  email: string;
  type: 'student';
}

export async function getStudentSession(req: NextRequest): Promise<StudentSession | null> {
  const token = req.cookies.get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if ((payload as any).type !== 'student') return null;
    return payload as unknown as StudentSession;
  } catch {
    return null;
  }
}

// GET — check student session
export async function GET(req: NextRequest) {
  const session = await getStudentSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({ authenticated: true, user: session });
}
