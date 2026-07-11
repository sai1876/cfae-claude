// [INTERNAL] - Restricted to staff, manager, admin, owner
import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const UpdateKdsItemStatusSchema = z.object({
  order_id: z.string().min(1),
  item_index: z.number().int().min(0),
  item_id: z.string().min(1).optional(),
  item_status: z.enum(['ordered', 'preparing', 'ready']),
  reason: z.string().max(300).optional()
}).strict();

export async function POST(req: Request) {
  try {
    const authResult = await requireRole(req, [
      'staff', 'manager', 'admin', 'owner',
      'deep_fryer', 'grill_fryer', 'biryani_master', 'brewer'
    ]);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const uid = authResult.uid!;
    const role = authResult.role!;

    const body = await req.json();
    const parseResult = UpdateKdsItemStatusSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: "Invalid payload format." }, { status: 400 });
    }

    const data = parseResult.data;
    const { order_id, item_index, item_id, item_status, reason } = data;
    
    const orderRef = adminDb.collection('orders').doc(order_id);
    let previous_status = 'ordered';
    let outlet_id = '';

    try {
      await adminDb.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        
        if (!orderSnap.exists) {
          throw { status: 404, message: "Order not found." };
        }
        
        const orderData = orderSnap.data()!;
        const items = orderData.items;

        if (!Array.isArray(items)) {
          throw { status: 400, message: "Order items is not an array." };
        }

        if (item_index >= items.length) {
          throw { status: 400, message: "Item index out of bounds." };
        }

        const targetItem = items[item_index];
        const stationUpper = (targetItem.station || '').toUpperCase();

        // Enforce station ownership
        if (role !== 'manager' && role !== 'admin' && role !== 'owner' && role !== 'staff') {
          if (role === 'deep_fryer' && stationUpper !== 'FRYER') throw { status: 403, message: "Forbidden: Station mismatch" };
          if (role === 'grill_fryer' && stationUpper !== 'GRILLED OR STEAMED') throw { status: 403, message: "Forbidden: Station mismatch" };
          if (role === 'biryani_master' && stationUpper !== 'FASTFOOD & BIRYANI') throw { status: 403, message: "Forbidden: Station mismatch" };
          if (role === 'brewer' && stationUpper !== 'BREWER') throw { status: 403, message: "Forbidden: Station mismatch" };
        }

        // Protect against stale index by checking item_id if provided
        if (item_id && targetItem.item_id !== item_id && targetItem.id !== item_id) {
          throw { status: 409, message: "Stale order item update. Please refresh KDS." };
        }

        previous_status = targetItem.item_status || 'ordered';

        // Clone items and update only the specified index
        const clonedItems = [...items];
        clonedItems[item_index] = {
          ...targetItem,
          item_status: item_status
        };

        outlet_id = orderData.outlet || orderData.outlet_id;

        transaction.update(orderRef, {
          items: clonedItems,
          updated_at: Date.now()
        });
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }
    
    // Log business event safely without PII
    await logBusinessEvent({
      event_type: 'kds_item_status_changed',
      actor_type: role as ActorType,
      actor_id: uid,
      target_type: 'order_item',
      target_id: `${order_id}:${item_index}`,
      order_id,
      ...(outlet_id && { outlet_id }),
      severity: 'info',
      source: 'api',
      metadata: {
        item_index,
        previous_status,
        next_status: item_status,
        ...(reason && { reason: reason.trim() }) // safe reason included
      }
    });

    console.log(`[KDS ITEM UPDATE] OrderId: ${order_id} | TicketId: ${order_id} | ItemIdx: ${item_index} | Old: ${previous_status} | New: ${item_status}`);

    return NextResponse.json({ 
      success: true, 
      order_id, 
      item_index,
      previous_status,
      next_status: item_status
    });

  } catch (error) {
    console.error("[UPDATE KDS ITEM STATUS ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
