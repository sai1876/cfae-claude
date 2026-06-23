import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function GET(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!adminDb) {
      throw new Error('Firebase Admin DB not initialized');
    }

    console.log('[CRON SOFT-DELETE] Initializing 60-second sweeper...');
    const now = admin.firestore.Timestamp.now();

    // Query PENDING orders that have expired
    const expiredSnap = await adminDb.collection('voice_orders')
      .where('status', '==', 'PENDING')
      .where('expires_at', '<=', now)
      .get();

    if (expiredSnap.empty) {
      console.log('[CRON SOFT-DELETE] No expired pending voice orders found.');
      return NextResponse.json({ success: true, processed: 0 });
    }

    const batch = adminDb.batch();
    expiredSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'SOFT_DELETED',
        soft_deleted_at: now
      });
    });

    await batch.commit();
    console.log(`[CRON SOFT-DELETE] Successfully soft-deleted ${expiredSnap.size} expired voice orders.`);

    return NextResponse.json({ success: true, processed: expiredSnap.size });

  } catch (error: any) {
    console.error('[CRON SOFT-DELETE ERROR] Sweeper failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
