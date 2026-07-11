import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['manager', 'admin', 'owner']);
    if (auth instanceof NextResponse) return auth;

    if (!adminDb) return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const outlet_id = searchParams.get('outlet_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = adminDb.collection('daily_closings');

    if (outlet_id) {
      query = query.where('outlet_id', '==', outlet_id);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }

    if (start_date) {
      query = query.where('business_date', '>=', start_date);
    }
    
    if (end_date) {
      query = query.where('business_date', '<=', end_date);
    }

    query = query.orderBy('business_date', 'desc').limit(limit);

    const snapshot = await query.get();
    const closings = snapshot.docs.map(doc => doc.data());

    return NextResponse.json({ success: true, closings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
