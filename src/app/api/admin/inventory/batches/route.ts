import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { DOUGH_BATCHES_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner', 'manager']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outletId');
    if (!outletId) return NextResponse.json({ success: false, error: 'outletId required' }, { status: 400 });

    const [activeSnap, logsSnap] = await Promise.all([
      adminDb.collection(DOUGH_BATCHES_COL).where('outlet_id', '==', outletId).where('status', '==', 'active').get(),
      adminDb.collection(DOUGH_BATCHES_COL).where('outlet_id', '==', outletId).where('status', '==', 'completed').orderBy('batch_start_time', 'desc').limit(50).get()
    ]);

    return NextResponse.json({
      success: true,
      activeBatches: activeSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      batchLogs: logsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
