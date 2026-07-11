import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { COMPLAINTS_COL } from '@/lib/firebase/collections';

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const body = await req.json();
    const { ticketId, resolutionNote } = body;

    if (!ticketId || !resolutionNote) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    await adminDb.collection(COMPLAINTS_COL).doc(ticketId).update({
      status: 'resolved',
      resolution: resolutionNote,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.uid
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
