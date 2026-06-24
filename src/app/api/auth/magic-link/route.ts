import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { session } = await request.json();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Missing session ID.' }, { status: 400 });
    }

    if (!adminDb || !adminAuth) {
      return NextResponse.json({ success: false, error: 'Firebase Admin not initialized.' }, { status: 500 });
    }

    const orderRef = adminDb.collection('voice_orders').doc(session);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: 'Order session not found or invalid.' }, { status: 404 });
    }

    const orderData = orderSnap.data()!;

    // Verify it's still pending/staged
    if (orderData.status !== 'staged' && orderData.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Order session has already been processed or cancelled.' }, { status: 400 });
    }

    // Verify expiration
    if (orderData.expires_at) {
      const expiresAt = orderData.expires_at.toMillis ? orderData.expires_at.toMillis() : orderData.expires_at;
      if (Date.now() > expiresAt) {
        return NextResponse.json({ success: false, error: 'Magic link expired. Please generate a new order.' }, { status: 401 });
      }
    }

    const userId = orderData.user_id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User mapping failed on this order.' }, { status: 400 });
    }

    // Generate Custom Auth Token
    const customToken = await adminAuth.createCustomToken(userId);

    // Format items for the cart
    const menuSnap = await adminDb.collection('menu').get();
    const menuItems = menuSnap.docs.map(doc => doc.data());

    const cartItems = orderData.items.map((item: any) => {
      const menuMatch = menuItems.find((m: any) => m.name === item.name);
      
      return {
        id: Math.random().toString(36).substring(7),
        menuItemId: menuMatch ? menuMatch.item_id : 'unknown',
        name: item.name,
        price: item.unit_price,
        quantity: item.qty,
        station: menuMatch ? (menuMatch.station || 'Beverage Station') : 'Beverage Station',
        modifiers: []
      };
    });

    return NextResponse.json({
      success: true,
      token: customToken,
      items: cartItems
    });

  } catch (error) {
    console.error('[MAGIC LINK ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to process magic link.' }, { status: 500 });
  }
}
