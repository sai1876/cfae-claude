import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { APPROVALS_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const snapshot = await adminDb.collection(APPROVALS_COL).orderBy('timestamp', 'desc').limit(50).get();
    const approvals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, approvals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
