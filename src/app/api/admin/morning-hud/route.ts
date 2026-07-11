import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';

export async function GET(req: Request) {
  // Secure Role-Based Authentication
  const authContext = await requireRole(req, ['owner', 'admin', 'manager']);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    return NextResponse.json({ success: true, tasks: [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}