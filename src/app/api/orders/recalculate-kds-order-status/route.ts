// [INTERNAL] - Recalculates top-level order status based on KDS items
import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import { logBusinessEvent, ActorType } from '@/server/events/logBusinessEvent';

const RecalculateSchema = z.object({
  order_id: z.string().min(1)
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
    const parseResult = RecalculateSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: "Invalid payload format." }, { status: 400 });
    }

    const { order_id } = parseResult.data;
    let next_status = 'pending';
    let previous_status = 'pending';
    let outlet_id = '';
    let statusChanged = false;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const orderRef = adminDb!.collection('orders').doc(order_id);
        const orderSnap = await transaction.get(orderRef);
        
        if (!orderSnap.exists) {
          throw { status: 404, message: "Order not found." };
        }
        
        const orderData = orderSnap.data()!;
        previous_status = orderData.status;
        outlet_id = orderData.outlet || orderData.outlet_id;
        
        if (['completed', 'cancelled'].includes(previous_status)) {
          throw { status: 403, message: "Cannot auto-transition terminal order states." };
        }

        const items = orderData.items || [];
        
        const allItemsReady = items.length > 0 && items.every((item: any) => item.item_status === 'ready');
        const anyItemPreparingOrReady = items.some((item: any) => item.item_status === 'preparing' || item.item_status === 'ready');

        if (allItemsReady) next_status = 'ready';
        else if (anyItemPreparingOrReady) next_status = 'preparing';
        else next_status = 'confirmed';

        if (next_status !== previous_status) {
          statusChanged = true;
          transaction.update(orderRef, {
            status: next_status,
            updated_at: Date.now()
          });
        }
      });
    } catch (txError: any) {
      if (txError.status) {
        return NextResponse.json({ success: false, error: txError.message }, { status: txError.status });
      }
      throw txError;
    }

    if (statusChanged) {
      await logBusinessEvent({
        event_type: 'order_status_changed',
        actor_type: role as ActorType,
        actor_id: uid,
        target_type: 'order',
        target_id: order_id,
        order_id: order_id,
        ...(outlet_id && { outlet_id }),
        severity: 'info',
        source: 'api',
        metadata: {
          previous_status,
          next_status,
          reason: 'KDS top-level auto-transition'
        }
      });
    }

    console.log(`[KDS ORDER RECALC] OrderId: ${order_id} | TicketId: ${order_id} | Parent Old: ${previous_status} | Parent New: ${next_status}`);

    return NextResponse.json({ 
      success: true, 
      order_id, 
      previous_status,
      next_status,
      changed: statusChanged
    });

  } catch (error) {
    console.error("[RECALCULATE KDS STATUS ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
