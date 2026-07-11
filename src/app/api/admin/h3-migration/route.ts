import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { latLngToCell } from 'h3-js';
import { requireRole } from '@/server/auth/requireRole';

export async function GET(request: Request) {
  // Secure Role-Based Authentication
  const authContext = await requireRole(request, ['owner', 'admin']);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Firebase Admin not configured' }, { status: 500 });
    }
    const staffRef = adminDb.collection('staff');
    const snapshot = await staffRef.where('role', '==', 'rider').get();

    const batch = adminDb.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.location && data.location.lat && data.location.lng) {
        // Calculate Resolution-9 Hexagon ID for the rider
        const h3Index = latLngToCell(data.location.lat, data.location.lng, 9);
        batch.update(doc.ref, { h3Index });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, updatedCount: count });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
