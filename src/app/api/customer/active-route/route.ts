import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    // 1. Fetch the requested order
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ waypoints: [] });
    }

    const orderData = orderDoc.data()!;
    
    // Only care about tracking if it's out for delivery and has a rider
    if (orderData.status !== 'out_for_delivery' || !orderData.rider_id) {
      return NextResponse.json({ waypoints: [] });
    }

    // 2. Fetch all out_for_delivery orders assigned to this rider
    const snapshot = await adminDb.collection('orders')
      .where('rider_id', '==', orderData.rider_id)
      .where('status', '==', 'out_for_delivery')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ waypoints: [] });
    }

    // 3. Sort orders by creation time (simulating a basic queue/sequence)
    const activeOrders = snapshot.docs.map(doc => ({
      id: doc.id,
      created_at: doc.data().created_at || new Date().toISOString(),
      coordinates: doc.data().delivery_coordinates
    })).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 4. Find where the current user's order is in the sequence
    const currentIndex = activeOrders.findIndex(o => o.id === orderId);

    // If it's the first order or not found, no prior waypoints
    if (currentIndex <= 0) {
      return NextResponse.json({ waypoints: [] });
    }

    // 5. Extract ONLY the coordinates of prior orders to ensure privacy
    const priorWaypoints = activeOrders
      .slice(0, currentIndex)
      .filter(o => o.coordinates && typeof o.coordinates.lat === 'number' && typeof o.coordinates.lng === 'number')
      .map(o => o.coordinates);

    return NextResponse.json({ waypoints: priorWaypoints });

  } catch (error) {
    console.error('Active route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
