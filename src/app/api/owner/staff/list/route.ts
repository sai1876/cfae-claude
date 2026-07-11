import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { STAFF_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const snapshot = await adminDb.collection(STAFF_COL).get();
    const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, staff });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
