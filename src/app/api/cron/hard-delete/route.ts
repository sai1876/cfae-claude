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

    console.log('[CRON HARD-DELETE] Initializing 24-hour hard-delete sweeper...');
    
    // 45 days in milliseconds
    const fortyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;
    const thresholdDate = new Date(Date.now() - fortyFiveDaysMs);
    const thresholdTimestamp = admin.firestore.Timestamp.fromDate(thresholdDate);

    // Query SOFT_DELETED orders that are older than 45 days
    const purgeSnap = await adminDb.collection('voice_orders')
      .where('status', '==', 'SOFT_DELETED')
      .where('soft_deleted_at', '<=', thresholdTimestamp)
      .get();

    if (purgeSnap.empty) {
      console.log('[CRON HARD-DELETE] No old soft-deleted orders to purge.');
      return NextResponse.json({ success: true, processed: 0 });
    }

    const batch = adminDb.batch();
    purgeSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[CRON HARD-DELETE] Successfully hard-deleted ${purgeSnap.size} junk voice orders.`);

    return NextResponse.json({ success: true, processed: purgeSnap.size });

  } catch (error: any) {
    console.error('[CRON HARD-DELETE ERROR] Purge sweeper failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
