import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrderServer } from '@/server/orders/createOrderServer';
import { adminAuth } from '@/lib/firebaseAdmin';
import { logBusinessEvent } from '@/server/events/logBusinessEvent';

const orderItemSchema = z.object({
  menuItemId: z.string().optional(),
  item_id: z.string().optional(),
  menu_item_id: z.string().optional(),
  name: z.string(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  station: z.string().optional(),
  modifiers: z.array(z.string()).optional()
}).transform(val => ({
  ...val,
  menuItemId: val.menuItemId || val.item_id || val.menu_item_id,
  menu_item_id: val.menuItemId || val.item_id || val.menu_item_id
}));

const createOrderSchema = z.object({
  clientExpectedTotal: z.number().nonnegative().optional(),
  promoCode: z.string().optional(),
  promo_code: z.string().optional(),
  pointsRedeemed: z.number().nonnegative().optional(),
  points_redeemed: z.number().nonnegative().optional(),
  orderType: z.enum(['dine-in', 'pickup', 'delivery']).optional(),
  order_type: z.enum(['dine-in', 'pickup', 'delivery']).optional(),
  items: z.array(orderItemSchema).min(1),
  hatch: z.string().optional(),
  tableNo: z.string().optional(),
  table_no: z.string().optional(),
  table_number: z.string().optional(),
  outlet: z.string().optional(),
  deliveryAddress: z.string().optional(),
  delivery_address: z.string().optional(),
  deliveryCoordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  delivery_coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional()
}).transform(val => ({
  ...val,
  promoCode: val.promoCode || val.promo_code,
  pointsRedeemed: val.pointsRedeemed ?? val.points_redeemed ?? 0,
  orderType: val.orderType || val.order_type,
  order_type: val.orderType || val.order_type,
  tableNo: val.tableNo || val.table_no || val.table_number,
  table_number: val.tableNo || val.table_no || val.table_number,
  deliveryAddress: val.deliveryAddress || val.delivery_address,
  deliveryCoordinates: val.deliveryCoordinates || val.delivery_coordinates
}));

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Internal server error (Auth not initialized)' }, { status: 500 });
    }
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    const body = await req.json();
    
    // Validate request body
    const result = createOrderSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input data', details: result.error.issues }, { status: 400 });
    }

    const {
      clientExpectedTotal,
      promoCode,
      pointsRedeemed,
      orderType,
      items,
      hatch,
      tableNo,
      outlet,
      deliveryAddress,
      deliveryCoordinates
    } = result.data;

    console.log("[DEBUG] /api/orders/create payload keys:", Object.keys(result.data));

    const orderData = await createOrderServer(
      userId,
      clientExpectedTotal,
      promoCode,
      pointsRedeemed,
      orderType || 'dine-in',
      items,
      hatch,
      tableNo,
      outlet,
      deliveryAddress,
      deliveryCoordinates
    );

    await logBusinessEvent({
      event_type: 'order_created',
      actor_type: 'customer',
      actor_id: userId,
      target_type: 'order',
      target_id: orderData.id,
      outlet_id: outlet || 'unknown',
      order_id: orderData.id,
      severity: 'info',
      source: 'checkout',
      metadata: {
        orderType,
        total: orderData.total_amount,
        itemsCount: items.length
      }
    });

    return NextResponse.json({ success: true, order: orderData });
  } catch (error: any) {
    console.error("Order API failed:", error);
    if (error && typeof error === 'object' && error.status && error.controlledMessage) {
      return NextResponse.json({ success: false, error: error.controlledMessage }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
