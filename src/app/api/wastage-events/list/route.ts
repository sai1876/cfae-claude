import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authResult = await requireRole(req, ['manager', 'admin', 'owner']);
    if (authResult instanceof NextResponse) return authResult;
    
    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get('limit') || '100');
    
    const snapshot = await adminDb.collection('wastage_events')
      .orderBy('created_at', 'desc')
      .limit(limitParam)
      .get();
      
    const events = snapshot.docs.map(doc => ({
      ...doc.data()
    }));

    return NextResponse.json({ success: true, events });

  } catch (error) {
    console.error("[WASTAGE LIST ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
