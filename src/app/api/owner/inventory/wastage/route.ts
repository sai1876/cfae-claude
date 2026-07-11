import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { WASTAGE_COL } from '@/lib/firebase/collections';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['owner', 'manager']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const data = await req.json();
    await adminDb.collection(WASTAGE_COL).add({
      ...data,
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
