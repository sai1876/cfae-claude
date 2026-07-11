import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { SHIFTS_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    
    let query: FirebaseFirestore.Query = adminDb.collection(SHIFTS_COL);
    if (date) {
      query = query.where('date', '==', date);
    }
    
    const snapshot = await query.get();
    const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, shifts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const shiftData = await req.json();
    await adminDb.collection(SHIFTS_COL).add(shiftData);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
