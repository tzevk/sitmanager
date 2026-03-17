/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const TRAINER_COOKIE = 'sit_trainer_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export interface TrainerSession {
  facultyId: number;
  name: string;
  email: string;
  type: 'trainer';
}

export async function getTrainerSession(req: NextRequest): Promise<TrainerSession | null> {
  const token = req.cookies.get(TRAINER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if ((payload as any).type !== 'trainer') return null;
    return payload as unknown as TrainerSession;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getTrainerSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({ authenticated: true, user: session });
}
