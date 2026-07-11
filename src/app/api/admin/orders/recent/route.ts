import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { ORDERS_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner', 'manager']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const sinceNum = since ? parseInt(since, 10) : 0;

    let query = adminDb.collection(ORDERS_COL);
    if (sinceNum > 0) {
      query = query.where('created_at', '>=', sinceNum) as any;
    }
    const snap = await query.get();

    return NextResponse.json({
      success: true,
      orders: snap.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
