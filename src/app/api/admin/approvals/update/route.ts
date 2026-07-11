import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { APPROVALS_COL } from '@/lib/firebase/collections';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const body = await req.json();
    const { request_id, status } = body;

    if (!request_id || !status) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    await adminDb.collection(APPROVALS_COL).doc(request_id).update({
      status,
      resolved_by: auth.uid,
      resolved_at: Date.now()
    });

    // Note: The actual execution of the requested payload (e.g. updating menu or staff)
    // is currently assumed to be done manually by the owner after approval, or handled via triggers.
    // If auto-execution is needed, it would be added here based on action_type.

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
