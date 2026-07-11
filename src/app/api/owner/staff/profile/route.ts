import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { STAFF_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner', 'manager']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    if (!uid) return NextResponse.json({ success: false, error: 'uid required' }, { status: 400 });

    const snap = await adminDb.collection(STAFF_COL).doc(uid).get();
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });

    return NextResponse.json({ success: true, staff: { id: snap.id, ...snap.data() } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
