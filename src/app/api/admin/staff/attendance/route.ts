import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { ATTENDANCE_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    
    let query: FirebaseFirestore.Query = adminDb.collection(ATTENDANCE_COL);
    if (date) {
      query = query.where('date', '==', date);
    }
    
    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const body = await req.json();
    const { action, staff_id, status, outlet, log_id } = body;

    if (action === 'clock_in') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const newLog = {
        staff_id,
        status,
        outlet,
        date: todayStr,
        timestamp: new Date().toISOString(),
      };
      await adminDb.collection(ATTENDANCE_COL).add(newLog);
      return NextResponse.json({ success: true });
    } else if (action === 'clock_out') {
      await adminDb.collection(ATTENDANCE_COL).doc(log_id).update({
        check_out: new Date().toISOString()
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
