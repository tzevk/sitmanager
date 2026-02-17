import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.json({ 
      success: false,
      authenticated: false, 
      session: null,
      user: null 
    });
  }
  
  return NextResponse.json({ 
    success: true,
    authenticated: true,
    session: {
      userId: session.userId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      department: session.department,
      role: session.role,
    },
    user: {
      id: session.userId,
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      department: session.department,
      role: session.role,
    }
  });
}
